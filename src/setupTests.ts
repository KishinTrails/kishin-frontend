import { MockCanvasRenderingContext2D } from './__mocks__/canvas';

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: function (contextType: string, contextAttributes?: any) {
    if (contextType === '2d') {
      return new MockCanvasRenderingContext2D();
    }
    return null;
  },
  writable: true,
  configurable: true,
});
