import { isAuthenticated, createAuthCookie, type Env } from '../../lib/auth';

interface LoginBody {
    passphrase: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body = (await context.request.json()) as LoginBody;

        if (!body.passphrase) {
            return Response.json({ error: 'Passphrase is required' }, { status: 400 });
        }

        if (body.passphrase !== context.env.AUTH_KEY) {
            return Response.json({ error: 'Invalid passphrase' }, { status: 401 });
        }

        const cookie = createAuthCookie(context.env.AUTH_KEY);
        return Response.json(
            { success: true },
            { headers: { 'Set-Cookie': cookie } }
        );
    } catch {
        return Response.json({ error: 'Invalid request' }, { status: 400 });
    }
};

// Check auth status
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const authenticated = isAuthenticated(context.request, context.env);
    return Response.json({ authenticated });
};
