import { Middleware, MiddlewareFactory } from '../types.js';
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
	create({ baseDir, isDebug }?: TemplateOptions): Middleware;
}
declare const templateFactory: TemplateFactory;
export default templateFactory;
