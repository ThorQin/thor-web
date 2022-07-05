import { Application, Controller, Middleware, MiddlewareFactory } from '../types';
export declare class HttpError extends Error {
	code: number;
	constructor(code: number, msg: string);
}
export declare type ControllerType =
	| Controller
	| {
			[key: string]: Controller;
	  };
export declare type ControllerCreateOptions = {
	baseDir?: string;
	rootPath?: string;
	controllers?: Record<string, ControllerType>;
	apiDocPath?: string;
};
declare class ControllerFactory implements MiddlewareFactory<ControllerCreateOptions> {
	create(app: Application, { baseDir, rootPath, controllers, apiDocPath }?: ControllerCreateOptions): Middleware;
}
declare const controllerFactory: ControllerFactory;
export default controllerFactory;
