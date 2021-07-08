import {
	Middleware,
	MiddlewareFactory,
	AccessHandler,
	PrivilegeHandler,
	Application,
	MiddlewareOptions,
	PermissionHandler,
} from '../types';
export declare class SecurityError extends Error {}
export interface SecurityOptions extends MiddlewareOptions {
	accessHandler?: AccessHandler;
	privilegeHandler?: PrivilegeHandler;
	permissionHandler?: PermissionHandler;
}
declare class SecurityFactory implements MiddlewareFactory<SecurityOptions> {
	create(app: Application, param?: SecurityOptions): Middleware;
}
declare const securityFactory: SecurityFactory;
export default securityFactory;
