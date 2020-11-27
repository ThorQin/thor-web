import { Middleware, MiddlewareFactory, AccessHandler, PrivilegeHandler, Application } from '../types';
export declare class SecurityError extends Error {}
export interface SecurityOptions {
	accessHandler?: AccessHandler;
	privilegeHandler?: PrivilegeHandler;
}
declare class SecurityFactory implements MiddlewareFactory {
	create(app: Application, param?: SecurityOptions): Middleware;
}
declare const securityFactory: SecurityFactory;
export default securityFactory;
