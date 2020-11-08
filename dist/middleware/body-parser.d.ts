import { MiddlewareFactory } from '../types';
import Context from '../context';
import http from 'http';
/**
 * Create body-parser middleware.
 */
declare class BodyParserFactory implements MiddlewareFactory {
	create(): (ctx: Context, req: http.IncomingMessage) => Promise<boolean>;
}
declare const bodyParser: BodyParserFactory;
export default bodyParser;
