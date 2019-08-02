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