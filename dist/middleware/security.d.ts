import {
	Middleware,
	MiddlewareFactory,
	AccessHandler,
	PrivilegeHandler,
	Application,
	MiddlewareOptions,
} from '../types';
export declare class SecurityError extends Error {}
export interface SecurityOptions extends MiddlewareOptions {
	accessHandler?: AccessHandler;
	privilegeHandler?: PrivilegeHandler;
}
declare class SecurityFactory implements MiddlewareFactory<SecurityOptions> {
	create(app: Application, param?: SecurityOptions): Middleware;
}
declare const securityFactory: SecurityFactory;
export default securityFactory;
