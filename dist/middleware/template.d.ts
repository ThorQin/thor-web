import { Application, Middleware, MiddlewareFactory } from '../types';
export declare type TemplateOptions = {
	/**
	 * The root directory of the controllers.
	 */
	baseDir?: string;
	/**
	 * Use debug mode
	 */
	isDebug?: boolean;
};
declare class TemplateFactory implements MiddlewareFactory {
	create(app: Application, { baseDir, isDebug }?: TemplateOptions): Middleware;
}
declare const templateFactory: TemplateFactory;
export default templateFactory;
