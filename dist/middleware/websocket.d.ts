import { Application, Middleware, MiddlewareFactory } from '../types';
export declare type WebSocketCreateOptions = {
	baseDir?: string;
	rootPath?: string;
	maxReceivedMessageSize?: number;
};
declare class WebSocketFactory implements MiddlewareFactory {
	create(app: Application, { baseDir, rootPath, maxReceivedMessageSize }?: WebSocketCreateOptions): Middleware | null;
}
declare const webSocketFactory: WebSocketFactory;
export default webSocketFactory;
