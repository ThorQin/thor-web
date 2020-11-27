import { Application, Middleware, MiddlewareFactory } from '../types';
export declare type ControllerCreateOptions = {
	baseDir?: string;
	rootPath?: string;
};
declare class ControllerFactory implements MiddlewareFactory {
	create(app: Application, { baseDir, rootPath }?: ControllerCreateOptions): Middleware;
}
declare const controllerFactory: ControllerFactory;
export default controllerFactory;
