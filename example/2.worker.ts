import { expose } from 'comlink'

/** even though we have "global state" here, it's per worker, not per file */
let globalState /* bad idea */ = 0;

export const myObj = {
  hello: 'world',
  inc() {
    // bad idea 2
    globalState++
    return globalState
  }
}

expose(myObj)