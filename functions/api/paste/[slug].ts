import { isAuthenticated, type Env } from '../../lib/auth';

// Get a single paste
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const slug = context.params.slug as string;

    const paste = await context.env.DB.prepare(
        'SELECT * FROM pastes WHERE slug = ?'
    )
        .bind(slug)
        .first();

    if (!paste) {
        return Response.json({ error: 'Paste not found' }, { status: 404 });
    }

    // If private, require auth
    if (paste.visibility === 'private') {
        if (!isAuthenticated(context.request, context.env)) {
            return Response.json({ error: 'This paste is private' }, { status: 403 });
        }
    }

    return Response.json({ paste });
};

// Update a paste
export const onRequestPut: PagesFunction<Env> = async (context) => {
    if (!isAuthenticated(context.request, context.env)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const slug = context.params.slug as string;

    try {
        const body = (await context.request.json()) as {
            title?: string;
            content?: string;
            language?: string;
            visibility?: 'public' | 'private';
            pinned?: number;
        };

        const existing = await context.env.DB.prepare(
            'SELECT id FROM pastes WHERE slug = ?'
        )
            .bind(slug)
            .first();

        if (!existing) {
            return Response.json({ error: 'Paste not found' }, { status: 404 });
        }

        const updates: string[] = [];
        const values: any[] = [];

        if (body.title !== undefined) {
            updates.push('title = ?');
            values.push(body.title);
        }
        if (body.content !== undefined) {
            updates.push('content = ?');
            values.push(body.content);
        }
        if (body.language !== undefined) {
            updates.push('language = ?');
            values.push(body.language);
        }
        if (body.visibility !== undefined) {
            updates.push('visibility = ?');
            values.push(body.visibility);
        }
        if (body.pinned !== undefined) {
            updates.push('pinned = ?');
            values.push(body.pinned as any);
        }

        if (updates.length === 0) {
            return Response.json({ error: 'No fields to update' }, { status: 400 });
        }

        updates.push("updated_at = datetime('now')");

        const result = await context.env.DB.prepare(
            `UPDATE pastes SET ${updates.join(', ')} WHERE slug = ?`
        )
            .bind(...values, slug)
            .run();

        if (!result.success) {
            return Response.json({ error: 'Failed to update paste' }, { status: 500 });
        }

        return Response.json({ success: true });
    } catch {
        return Response.json({ error: 'Invalid request' }, { status: 400 });
    }
};

// Delete a paste
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    if (!isAuthenticated(context.request, context.env)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const slug = context.params.slug as string;

    const existing = await context.env.DB.prepare(
        'SELECT id FROM pastes WHERE slug = ?'
    )
        .bind(slug)
        .first();

    if (!existing) {
        return Response.json({ error: 'Paste not found' }, { status: 404 });
    }

    const result = await context.env.DB.prepare(
        'DELETE FROM pastes WHERE slug = ?'
    )
        .bind(slug)
        .run();

    if (!result.success) {
        return Response.json({ error: 'Failed to delete paste' }, { status: 500 });
    }

    return Response.json({ success: true });
};
