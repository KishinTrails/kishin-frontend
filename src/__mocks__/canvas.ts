interface MockCall {
  method: string;
  args: any[];
}

export class MockCanvasRenderingContext2D {
  private calls: MockCall[] = [];
  
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  globalCompositeOperation: string = 'source-over';
  
  getCallHistory(): MockCall[] {
    return [...this.calls];
  }
  
  getCallsByMethod(method: string): MockCall[] {
    return this.calls.filter(call => call.method === method);
  }
  
  getLastCall(method: string): MockCall | undefined {
    return this.calls.slice().reverse().find(call => call.method === method);
  }
  
  clearHistory(): void {
    this.calls = [];
  }
  
  clearRect(x: number, y: number, width: number, height: number): void {
    this.calls.push({ method: 'clearRect', args: [x, y, width, height] });
  }
  
  fillRect(x: number, y: number, width: number, height: number): void {
    this.calls.push({ method: 'fillRect', args: [x, y, width, height] });
  }
  
  beginPath(): void {
    this.calls.push({ method: 'beginPath', args: [] });
  }
  
  moveTo(x: number, y: number): void {
    this.calls.push({ method: 'moveTo', args: [x, y] });
  }
  
  lineTo(x: number, y: number): void {
    this.calls.push({ method: 'lineTo', args: [x, y] });
  }
  
  closePath(): void {
    this.calls.push({ method: 'closePath', args: [] });
  }
  
  fill(path?: Path2D | CanvasFillRule, fillRule?: CanvasFillRule): void {
    this.calls.push({ method: 'fill', args: [path, fillRule] });
  }
  
  save(): void {
    this.calls.push({ method: 'save', args: [] });
  }
  
  restore(): void {
    this.calls.push({ method: 'restore', args: [] });
  }
  
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
    this.calls.push({ method: 'arc', args: [x, y, radius, startAngle, endAngle, counterclockwise] });
  }
  
  stroke(): void {
    this.calls.push({ method: 'stroke', args: [] });
  }
  
  clip(fillRule?: CanvasFillRule): void {
    this.calls.push({ method: 'clip', args: [fillRule] });
  }
  
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient {
    this.calls.push({ method: 'createLinearGradient', args: [x0, y0, x1, y1] });
    return {} as CanvasGradient;
  }
  
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient {
    this.calls.push({ method: 'createRadialGradient', args: [x0, y0, r0, x1, y1, r1] });
    return {} as CanvasGradient;
  }
  
  createPattern(image: CanvasImageSource, repetition: string | null): CanvasPattern | null {
    this.calls.push({ method: 'createPattern', args: [image, repetition] });
    return null;
  }
  
  drawImage(image: CanvasImageSource, dx: number, dy: number, dWidth?: number, dHeight?: number, sx?: number, sy?: number, sWidth?: number, sHeight?: number): void {
    this.calls.push({ method: 'drawImage', args: [image, dx, dy, dWidth, dHeight, sx, sy, sWidth, sHeight] });
  }
  
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData {
    this.calls.push({ method: 'getImageData', args: [sx, sy, sw, sh] });
    return {} as ImageData;
  }
  
  putImageData(imagedata: ImageData, dx: number, dy: number, dirtyX?: number, dirtyY?: number, dirtyWidth?: number, dirtyHeight?: number): void {
    this.calls.push({ method: 'putImageData', args: [imagedata, dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight] });
  }
  
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.calls.push({ method: 'setTransform', args: [a, b, c, d, e, f] });
  }
  
  getTransform(): DOMMatrix {
    this.calls.push({ method: 'getTransform', args: [] });
    return {} as DOMMatrix;
  }
  
  resetTransform(): void {
    this.calls.push({ method: 'resetTransform', args: [] });
  }
  
  rotate(angle: number): void {
    this.calls.push({ method: 'rotate', args: [angle] });
  }
  
  scale(x: number, y: number): void {
    this.calls.push({ method: 'scale', args: [x, y] });
  }
  
  translate(x: number, y: number): void {
    this.calls.push({ method: 'translate', args: [x, y] });
  }
  
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.calls.push({ method: 'transform', args: [a, b, c, d, e, f] });
  }
  
  measureText(text: string): TextMetrics {
    this.calls.push({ method: 'measureText', args: [text] });
    return {} as TextMetrics;
  }
  
  fillText(text: string, x: number, y: number, maxWidth?: number): void {
    this.calls.push({ method: 'fillText', args: [text, x, y, maxWidth] });
  }
  
  strokeText(text: string, x: number, y: number, maxWidth?: number): void {
    this.calls.push({ method: 'strokeText', args: [text, x, y, maxWidth] });
  }
  
  createImageData(sw: number, sh: number): ImageData {
    this.calls.push({ method: 'createImageData', args: [sw, sh] });
    return {} as ImageData;
  }
  
  isPointInPath(x: number, y: number, fillRule?: CanvasFillRule): boolean {
    this.calls.push({ method: 'isPointInPath', args: [x, y, fillRule] });
    return false;
  }
  
  isPointInStroke(x: number, y: number): boolean {
    this.calls.push({ method: 'isPointInStroke', args: [x, y] });
    return false;
  }
  
  rect(x: number, y: number, w: number, h: number): void {
    this.calls.push({ method: 'rect', args: [x, y, w, h] });
  }
  
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.calls.push({ method: 'quadraticCurveTo', args: [cpx, cpy, x, y] });
  }
  
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
    this.calls.push({ method: 'bezierCurveTo', args: [cp1x, cp1y, cp2x, cp2y, x, y] });
  }
  
  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
    this.calls.push({ method: 'ellipse', args: [x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise] });
  }
  
  lineCap: CanvasLineCap = 'butt';
  lineDashOffset: number = 0;
  lineJoin: CanvasLineJoin = 'miter';
  lineWidth: number = 1;
  miterLimit: number = 10;
  shadowBlur: number = 0;
  shadowColor: string = '#000000';
  shadowOffsetX: number = 0;
  shadowOffsetY: number = 0;
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000000';
  textAlign: CanvasTextAlign = 'start';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  direction: CanvasDirection = 'inherit';
  font: string = '10px sans-serif';
  fontKerning: CanvasFontKerning = 'auto';
  fontStretch: string = 'normal';
  fontVariantCaps: string = 'normal';
  imageSmoothingEnabled: boolean = true;
  imageSmoothingQuality: CanvasImageSmoothingQuality = 'low';
  letterSpacing: string = '0px';
  lineDash: number[] = [];
  textRendering: string = 'auto';
  wordSpacing: string = '0px';
  
  getLineDash(): number[] {
    this.calls.push({ method: 'getLineDash', args: [] });
    return [];
  }
  
  setLineDash(segments: number[]): void {
    this.calls.push({ method: 'setLineDash', args: [segments] });
  }
}

export class MockHTMLCanvasElement {
  private mockContext: MockCanvasRenderingContext2D | null = null;
  private _width: number = 300;
  private _height: number = 150;
  
  width: number = 300;
  height: number = 150;
  
  constructor() {
    this.mockContext = new MockCanvasRenderingContext2D();
  }
  
  getContext(contextType: string, contextAttributes?: any): MockCanvasRenderingContext2D | null {
    if (contextType === '2d' && this.mockContext) {
      return this.mockContext;
    }
    return null;
  }
  
  getMockContext(): MockCanvasRenderingContext2D | null {
    return this.mockContext;
  }
  
  toDataURL(type?: string, quality?: any): string {
    return 'data:image/png;base64,';
  }
  
  toBlob(callback: BlobCallback, type?: string, quality?: any): void {
    callback(null);
  }
  
  transferControlToOffscreen(): OffscreenCanvas {
    return {} as OffscreenCanvas;
  }
  
  captureStream(frameRequestRate?: number): MediaStream {
    return {} as MediaStream;
  }
  
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {}
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {}
  dispatchEvent(event: Event): boolean {
    return true;
  }
}

export function createMockCanvas(): MockHTMLCanvasElement {
  return new MockHTMLCanvasElement();
}

export function createMockContext(): MockCanvasRenderingContext2D {
  return new MockCanvasRenderingContext2D();
}
