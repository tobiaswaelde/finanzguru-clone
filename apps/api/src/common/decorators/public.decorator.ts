import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ROUTE = 'finance:public';

/** Mark an intentionally unauthenticated endpoint for the session guard. */
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
