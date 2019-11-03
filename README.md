[![NPM](https://nodei.co/npm/react-use-comlink.svg?downloads=true)](https://nodei.co/npm/react-use-comlink/)
[![TypeScript](https://badges.frapsoft.com/typescript/love/typescript.svg?v=101)](https://github.com/ellerbrock/typescript-badges/)

# react-use-comlink

Three ways to use [Comlink](https://github.com/GoogleChromeLabs/comlink) web workers through React Hooks (and in a typesafe manner).

## Usage

```tsx
// worker.ts
import { expose } from 'comlink'

export class MyClass {
  private _counter: number

  constructor(init: number) {
    this._counter = init
  }

  get counter() {
    return this._counter
  }

  increment(delta = 1) {
    this._counter += delta
  }
}

expose(MyClass)
```

```tsx
// index.ts
import React from 'react'
import useComlink from 'react-use-comlink'
import { WorkerClass } from './worker'

const App: React.FC<{startAt: number}> = (props) => {
  const [state, setState] = React.useState(0)

  const { proxy } = useComlink<typeof WorkerClass>(
    () => new Worker('./worker.ts'),
    [ props.startAt ] // used to recreate the worker if it change, defaults to []
  )

  React.useEffect(() => {
    (async () => {
      // methods, constructors and setters are async
      const classInstance = await new proxy(0)

      await classInstance.increment(1)

      // even getters are asynchronous, regardless of type
      setState(await classInstance.counter)
    })()
  }, [proxy])

  return (
    <div>{state}</div>
  )
}

ReactDOM.render(
  <App />,
  document.getElementById('root')
)
```

Also notice that the `worker` property is also exposed, so you may use the library directly with workers without having to use Comlink (kinda defeats the purpose, but oh well):

```tsx
const App = () => {
  const { worker } = useComlink('./worker.js')

  useEffect(() => {
    worker.onmessage = (e) => {
      /*do stuff*/
    }

    worker.onerror = (e) => {
      /*do stuff*/
    }
  }, [worker])

  const callback = useCallback(() => {
    worker.postMessage('wow')
  }, [worker])

  return (<button onClick={callback}>Post WOW</button>)
}
```

## API

The api is pretty straightforward, you have the _in loco_ `useComlink`, the factory counter part `createComlink` and the singleton counter part `createComlinkSingleton`.

### useComlink<T = unknown>(initWorker: Blob | string | () => Worker | string | Blob, deps: any[]): { proxy<T>, worker }

Use directly inside components. Both object and properties are memoized and can be used as deps.

```tsx
const MyComponent: React.FC = () => {
  const { proxy, worker } = useComlink(() => new Worker('./worker.js'), [deps])
}
```

### createComlink<T = unknown>(initWorker: () => Worker | string | Blob, options = {}): () => { proxy<T>, worker }

Creates a factory version that can spawn multiple workers with the same settings

```tsx
// outside, just like react-cache, createResource
const useNumber = createComlink<number>(
  () => new Worker('worker.js')
)

const MyComponent: React.FC = () => {
  const { proxy, worker } = useNumber() // call like a hook

  useEffect(() => {
    (async () => {
      const number = await proxy
      // use number
    })()
  }, [proxy])

  return null
}
```

### createComlinkSingleton<T = unknown>(initWorker: Worker, options: WorkerOptions = {}): () => { proxy<T>, worker }

If you want to keep the same state between multiple components, be my guest. Not the best choice for modularity, but hey, I just make the tools. Notice that the worker is never terminated, and must be done on demand (on `worker.terminate()`)

```tsx
const useSingleton = createComlinkSingleton<() => Bad>(new Worker('./bad.idea.worker.js'))

const MyComponent: React.FC = () => {
  const { proxy } = useSingleton()

  useEffect(() => {
    (async () => {
      const isBad = await proxy()
    })()
  }, [proxy])

  return null
}
```

## Comlink

Make sure the read the Comlink documentation, being the most important part what can be [structure cloned](https://github.com/GoogleChromeLabs/comlink#comlinktransfervalue-transferables-and-comlinkproxyvalue)

## Caveats

Every function with Comlink is async (because you're basically communicating to another thread through web workers), even class instantiation (using new), so local state can't be retrieved automatically from the exposed class, object or function, having to resort to wrapping some code with self invoking `async` functions, or relying on `.then()`. If your render depends on the external worker result, you'll have to think of an intermediate state.

Although the worker will be terminated when the component is unmounted, your code might try to "set" the state of an unmounted component because of how workers work (:P) on their own separate thread in a truly async manner.

In the future, when `react-cache` and Concurrent Mode is upon us, this library will be updated to work nicely with Suspense and the async nature of Comlink

## Example

Run `npm run example` from root then open `http://localhost:1234`

## TODO

Write tests (hardcore web workers tests)

## License

MIT