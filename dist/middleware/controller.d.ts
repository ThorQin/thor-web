import { Application, Middleware, MiddlewareFactory } from '../types';
export declare class HttpError extends Error {
	code: number;
	constructor(code: number, msg: string);
}
export declare type ControllerCreateOptions = {
	baseDir?: string;
	rootPath?: string;
};
declare class ControllerFactory implements MiddlewareFactory<ControllerCreateOptions> {
	create(app: Application, { baseDir, rootPath }?: ControllerCreateOptions): Middleware;
}
declare const controllerFactory: ControllerFactory;
export default controllerFactory;
