import { Middleware, MiddlewareFactory, SecurityHandler } from '../types';
export declare class SecurityError extends Error {}
declare class SecurityFactory implements MiddlewareFactory {
	create(securityHandler: SecurityHandler): Middleware;
}
declare const securityFactory: SecurityFactory;
export default securityFactory;
