'use strict'

import { useMemo, useEffect } from 'react'
import { wrap, Remote } from 'comlink'

export type WorkerTypes = Blob | string | ReturnWorkerTypes
export type ReturnWorkerTypes = () => Exclude<WorkerTypes, ReturnWorkerTypes> | Worker

export interface Comlink<T> {
  /** the Worker itself, exposed for mocking, debugging, etc */
  worker: Worker
  /** Comlink proxy through `Comlink.wrap(worker)` */
  proxy: Remote<T>
}

export function processWorker(
  worker: WorkerTypes,
  options?: WorkerOptions,
): Worker;
export function processWorker(
  worker: WorkerTypes | Worker,
  options: WorkerOptions,
  acceptsWorker: boolean
): Worker;
/** Helper for initializing a new worker from strings, factories or blobs */
export function processWorker(
  worker: WorkerTypes | Worker,
  options: WorkerOptions = {},
  acceptsWorker: boolean = false
): Worker {
  let innerWorker: Worker

  if (acceptsWorker && worker instanceof Worker) {
    innerWorker = worker
  } else if (worker instanceof Blob) {
    innerWorker = new Worker(URL.createObjectURL(worker), options)
  } else if (typeof worker === 'string') {
    innerWorker = new Worker(worker, options)
  } else if (typeof worker === 'function' && !(worker instanceof Worker)) {
    return processWorker(worker(), options, true)
  } else {
    throw new TypeError('CreateUseComlink needs either a Worker factory instance, a Blob or a string containing a path')
  }

  return innerWorker
}

/**
 * Use the hook directly inside another React Hook or component. Best way to initialize it
 * is to either use a factory that returns a `new Worker()`, or using an string path (but bundlers
 * like Parcel won't be able to 'inline' the worker for you).
 *
 * The hook does not assumes knowledge of your worker (if it's a class, object, array, etc),
 * so you must keep the internal state and initialize any classes by yourself
 *
 * @example
 *   const MyApp = () => {
 *     const [state, setState] = useState('initialState')
 *     const { proxy } = useComlink(() => new Worker('./some.worker.js')) // initialize worker once
 *
 *     useEffect(() => {
 *       (async () => {
 *         setState(await proxy.method('some', 'arguments'))
 *       })()
 *       // or plain old
 *       proxy.method().then(setState)
 *     }, [proxy, setState])
 *
 *     return (<div>{state}</div>)
 *   }
 */
export function useComlink<
  T = unknown
>(
  initWorker: WorkerTypes,
  deps: React.DependencyList = [],
  options: WorkerOptions = {},
): Comlink<T> {
  const instance = useMemo<Comlink<T>>(() => {
    const worker = processWorker(initWorker, options)
    const proxy = wrap<T>(worker)

    return {
      worker,
      proxy,
    }
  }, deps)

  useEffect(() => {
    const innerWorker = instance.worker
    return () => innerWorker.terminate()
  }, [instance])

  return instance
}

/**
 * Creates a comlink factory from the same Worker for usage multiple times.
 *
 * @example
 *
 *    // returns a reusable hook
 *    const useMyClass = createComlink<typeof MyClass>(
 *      () => new Worker('./some.worker.js'),
 *    )
 *
 *    const Component: React.FC = () => {
 *       const { proxy, worker } = useMyClass()
 *
 *       useEffect(() => {
 *         proxy.someMethod().then((r) => doSomething(r))
 *       }, [proxy])
 *    }
 */
export function createComlink<
  T = unknown
>(
  initWorker: ReturnWorkerTypes,
  options: WorkerOptions = {},
): () => Comlink<T> {

  const worker = () => processWorker(initWorker, options)
  const proxy = (w: Worker) => wrap<T>(w)

  return () => {
    const instance = useMemo<Comlink<T>>(() => {
      const innerWorker = worker()
      const innerProxy = proxy(innerWorker)

      return {
        proxy: innerProxy,
        worker: innerWorker
      }
    }, [worker, proxy])

    useEffect(() => {
      const innerWorker = instance.worker
      return () => innerWorker.terminate()
    }, [instance])

    return instance
  }
}

/**
 * Creates one instance of a worker that can be instantiated inside components and share a global state.
 * It always loads the worker before mounting any components, so most likely the worker will be
 * ready to use when called inside a component.
 *
 * NOTE: This creates ONE instance of the worker, with a global state, and it should be
 * used very carefully (and sparsingly). The global state won't show the same value on other
 * mounted components unless you query it. One of the problems with using this is that sometimes
 * the browser might FREE the worker during a GC
 *
 * @see https://github.com/GoogleChromeLabs/comlink/issues/63
 *
 * @example
 *  const useMyMethods = createComlinkSingleton(new Worker('./worker.js')) // outside the component, it's a factory
 *
 *  const MyComponent = () => {
 *    const myMethods = useMyMethods() // returns { proxy, worker }
 *
 *    useEffect(() => {
 *      (async function(){
 *        await myMethods.proxy.someMethod()
 *      })()
 *
 *      return () => myMethods.worker.terminate() // bad things may happen!
 *    }, [myMethods]) // myMethods is a memoed object, so it's considered stable
 *
 *    return (<div />)
 *  }
 */
export function createComlinkSingleton<T = unknown>(initWorker: Worker, options: WorkerOptions = {}): () => Comlink<T> {
  const worker = processWorker(initWorker, options, true)
  const proxy = wrap<T>(worker)

  return () => {
    return useMemo(() => ({
      worker,
      proxy
    }), [worker, proxy])
  }
}

export default useComlink