import { createClientFromRequest } from 'npm:@base44/sdk@0.8.18';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        const convs = await base44.asServiceRole.agents.listConversations({
            agent_name: 'booth_designer'
        });
        
        if (convs.length > 0) {
            const conv = convs[0];
            return Response.json({ messages: conv.messages });
        }
        
        return Response.json({ messages: [] });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});