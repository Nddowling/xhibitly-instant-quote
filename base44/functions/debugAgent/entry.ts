import { createClientFromRequest } from 'npm:@base44/sdk@0.8.18';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const convs = await base44.asServiceRole.agents.listConversations({
            agent_name: 'booth_designer'
        });
        
        if (convs.length > 0) {
            // Sort by created_date descending
            convs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
            const conv = convs[0];
            return Response.json({ 
                id: conv.id,
                metadata: conv.metadata,
                messageCount: conv.messages ? conv.messages.length : 0,
                lastMessages: conv.messages ? conv.messages.slice(-5) : []
            });
        }
        
        return Response.json({ messages: [] });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});