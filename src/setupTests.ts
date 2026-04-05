import { MockCanvasRenderingContext2D } from './__mocks__/canvas';

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: function (contextType: string, contextAttributes?: any) {
    if (contextType === '2d') {
      return new MockCanvasRenderingContext2D();
    }
    if (contextType === 'webgl' || contextType === 'experimental-webgl') {
      return null;
    }
    return null;
  },
  writable: true,
  configurable: true,
});
