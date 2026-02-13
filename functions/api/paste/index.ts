import { isAuthenticated, type Env } from '../../lib/auth';
import { generateSlug } from '../../lib/slugs';

// List pastes
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const authenticated = isAuthenticated(context.request, context.env);
        const url = new URL(context.request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
        const offset = (page - 1) * limit;

        let query: string;
        let countQuery: string;

        if (authenticated) {
            // Authenticated: show all pastes
            query = 'SELECT id, slug, title, language, visibility, created_at, updated_at, substr(content, 1, 200) as preview FROM pastes ORDER BY created_at DESC LIMIT ? OFFSET ?';
            countQuery = 'SELECT COUNT(*) as total FROM pastes';
        } else {
            // Public: show only public pastes
            query = "SELECT id, slug, title, language, visibility, created_at, updated_at, substr(content, 1, 200) as preview FROM pastes WHERE visibility = 'public' ORDER BY created_at DESC LIMIT ? OFFSET ?";
            countQuery = "SELECT COUNT(*) as total FROM pastes WHERE visibility = 'public'";
        }

        const pastes = await context.env.DB.prepare(query).bind(limit, offset).all();
        const countResult = await context.env.DB.prepare(countQuery).first<{ total: number }>();

        return Response.json({
            pastes: pastes.results,
            total: countResult?.total || 0,
            page,
            limit,
            hasMore: offset + limit < (countResult?.total || 0),
        });
    } catch (err) {
        console.error('Failed to list pastes:', err);
        return Response.json({ error: 'Failed to load pastes' }, { status: 500 });
    }
};

// Create paste
export const onRequestPost: PagesFunction<Env> = async (context) => {
    if (!isAuthenticated(context.request, context.env)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = (await context.request.json()) as {
            title?: string;
            content: string;
            language?: string;
            visibility?: 'public' | 'private';
        };

        if (!body.content || body.content.trim() === '') {
            return Response.json({ error: 'Content is required' }, { status: 400 });
        }

        // Generate unique slug with retry
        let slug = generateSlug();
        let attempts = 0;
        while (attempts < 5) {
            const existing = await context.env.DB.prepare(
                'SELECT id FROM pastes WHERE slug = ?'
            )
                .bind(slug)
                .first();
            if (!existing) break;
            slug = generateSlug();
            attempts++;
        }

        const result = await context.env.DB.prepare(
            'INSERT INTO pastes (slug, title, content, language, visibility) VALUES (?, ?, ?, ?, ?)'
        )
            .bind(
                slug,
                body.title || '',
                body.content,
                body.language || 'plaintext',
                body.visibility || 'private'
            )
            .run();

        if (!result.success) {
            return Response.json({ error: 'Failed to create paste' }, { status: 500 });
        }

        return Response.json({ slug, success: true }, { status: 201 });
    } catch {
        return Response.json({ error: 'Invalid request' }, { status: 400 });
    }
};
