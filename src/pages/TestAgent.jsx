import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function TestAgent() {
    const [log, setLog] = useState([]);
    const appendLog = (msg) => setLog(prev => [...prev, msg]);

    useEffect(() => {
        async function run() {
            try {
                appendLog("Creating conversation...");
                const conv = await base44.agents.createConversation({
                    agent_name: "product_assistant",
                    metadata: { name: "Test" }
                });
                appendLog("Conversation created: " + JSON.stringify(conv));
                
                base44.agents.subscribeToConversation(conv.id, (data) => {
                    appendLog("Subscription update: " + JSON.stringify(data.messages?.length) + " messages");
                });

                await base44.agents.addMessage(conv, {
                    role: "user",
                    content: "Hello, agent!"
                });
                appendLog("Message added");
            } catch (err) {
                appendLog("Error: " + err.message);
            }
        }
        run();
    }, []);

    return <div className="p-10">
        <h1 className="text-xl font-bold">Agent Test</h1>
        <pre className="mt-4 bg-gray-100 p-4 rounded text-xs">{log.join('\n')}</pre>
    </div>;
}