import { clearAuthCookie, type Env } from '../../lib/auth';

export const onRequestPost: PagesFunction<Env> = async () => {
    const cookie = clearAuthCookie();
    return Response.json(
        { success: true },
        { headers: { 'Set-Cookie': cookie } }
    );
};
