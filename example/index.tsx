import React, { useCallback, useState, useEffect, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { MyClass } from './1.worker'
import { myObj } from './2.worker'
import useComlink, { createComlink, createComlinkSingleton } from '../src/react-use-comlink'

const useMyClass = createComlink<typeof MyClass>(
  () => new Worker('./1.worker.ts'),
)

const Main: React.FC<{ startAt: number }> = (props) => {
  const [counter, setCounter] = useState(0)
  const [unmounted, setUnmounted] = useState(false)

  const myclass = useMyClass()
  const instance = useMemo(() => {
    return new myclass.proxy(props.startAt)
  }, [myclass, props.startAt])

  const cb = useCallback(async () => {
    const use = await instance
    await use.increment(1)
    setCounter(await use.counter)
  }, [instance, setCounter])

  const toggleUnmount = useCallback(() => {
    setUnmounted((state) => !state)
  }, [setUnmounted])

  return (
    <div>
      <p>Counter: {counter}</p>
      <button onClick={cb}>Increase from Comlink</button>
      <hr />
      {unmounted ? null : <Sub />}
      <hr />
      {/* <Sub /> */}
      <hr />
      <button onClick={toggleUnmount}>{unmounted ? 'Mount Sub' : 'Unmount Sub'}</button>
    </div>
  )
}

/**
 * initialize a hook from your worker class.
 * it doesn't actually import MyClass from worker.js, but only the defitions
 * when you're using Typescript! So your code is still strongly typed
 *
 * This is important for performance so the `new Worker()` isn't eagerly
 * evaluated on every render, like it happens with
 *
 *    useComlink(new Worker('./worker.js')) // created every render
 *
 * best to be
 *
 *    const myWorker = new Worker('./worker') // outside
 *
 *    const App = () => {
 *      useComlink(myWorker)
 *    }
 */
const useObj = createComlinkSingleton<typeof myObj>(new Worker('./2.worker.ts'))

const Sub: React.FunctionComponent = () => {
  const [state, setState] = useState({ globalcount: 0, localcount: 0 })
  const directly = useComlink<typeof myObj>(
    () => {
      return new Worker('./2.worker.ts')
    }
  )

  const globalObj = useObj()

  const incCounts = async () => {
    const localcount = await directly.proxy.inc()

    setState((prevState) => {
      return { ...prevState, localcount }
    })
  }

  useEffect(() => {
    incCounts()
  }, [directly, setState])

  useEffect(() => {
    (async () => {
      const globalcount = await globalObj.proxy.inc()

      setState((prevState) => {
        return { ...prevState, globalcount }
      })
    })()
  }, [globalObj, setState])

  const cb = useCallback(() => {
    incCounts()
  }, [directly])

  return (
    <div>
      <button onClick={cb}>Increase local</button>
      <p>Global worker instance count: {state.globalcount}</p>
      <p>Local worker instance count: {state.localcount}</p>
    </div>
  )
}

const App: React.FunctionComponent = () => {
  return (
    <React.StrictMode>
      <React.Suspense fallback={<p>Loading</p>}>
        <Main startAt={0} />
      </React.Suspense>
    </React.StrictMode>
  )
}

ReactDOM.render(
  <App />,
  document.getElementById('root'),
)
