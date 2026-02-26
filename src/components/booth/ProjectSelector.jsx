import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Plus, User, Building, FolderOpen, ArrowLeft, Loader2, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProjectSelector({ onSelectProject, onNewProject }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [view, setView] = useState('search'); // 'search' | 'client_projects'
    const [selectedClient, setSelectedClient] = useState(null);
    const [projects, setProjects] = useState([]);
    const [clients, setClients] = useState([]);
    const [clientProjects, setClientProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.trim()) {
                performSearch(searchTerm);
            } else {
                // Load recent items if search is empty
                loadRecents();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const loadRecents = async () => {
        setIsLoading(true);
        try {
            // Fetch recent projects
            const recentProjects = await base44.entities.BoothDesign.list('-created_date', 10);
            
            // Fetch dealer (user) information for these projects
            const dealerIds = [...new Set(recentProjects.map(p => p.dealer_id).filter(Boolean))];
            if (dealerIds.length > 0) {
                // Not ideal for huge sets, but for 10 recents it's fine
                const allUsers = await base44.entities.User.list();
                const userMap = allUsers.reduce((acc, user) => {
                    acc[user.id] = user;
                    return acc;
                }, {});
                
                recentProjects.forEach(p => {
                    if (p.dealer_id && userMap[p.dealer_id]) {
                        p._dealer_company = userMap[p.dealer_id].company_name || userMap[p.dealer_id].full_name;
                    }
                });
            }
            
            setProjects(recentProjects);
            setClients([]); // Clear clients when not searching specifically? Or maybe show recent contacts?
        } catch (e) {
            console.error("Error loading recents:", e);
        } finally {
            setIsLoading(false);
        }
    };

    const performSearch = async (term) => {
        setIsLoading(true);
        try {
            const lowerTerm = term.toLowerCase();

            // 1. Search Projects (BoothDesign)
            // Fetching a bit more to filter client-side if needed since regex might not be fully supported in all adapters
            const allProjects = await base44.entities.BoothDesign.list('-created_date', 100); 
            
            // Fetch users to map companies
            const allUsers = await base44.entities.User.list(); 
            const userMap = allUsers.reduce((acc, user) => {
                acc[user.id] = user;
                return acc;
            }, {});
            
            allProjects.forEach(p => {
                if (p.dealer_id && userMap[p.dealer_id]) {
                    p._dealer_company = userMap[p.dealer_id].company_name || userMap[p.dealer_id].full_name;
                }
            });
            
            const matchedProjects = allProjects.filter(p => 
                (p.design_name && p.design_name.toLowerCase().includes(lowerTerm)) ||
                (p.booth_size && p.booth_size.toLowerCase().includes(lowerTerm)) ||
                (p._dealer_company && p._dealer_company.toLowerCase().includes(lowerTerm))
            );
            setProjects(matchedProjects.slice(0, 10));

            // 2. Search Clients (User)
            // Searching users by name or company
            // Note: In a real large DB this should be a backend search.
            const allUsers = await base44.entities.User.list(); // Warning: Listing all users might be heavy in prod, but ok for now.
            const matchedClients = allUsers.filter(u => 
                (u.full_name && u.full_name.toLowerCase().includes(lowerTerm)) ||
                (u.email && u.email.toLowerCase().includes(lowerTerm)) ||
                (u.company_name && u.company_name.toLowerCase().includes(lowerTerm))
            );
            setClients(matchedClients.slice(0, 10));

        } catch (e) {
            console.error("Error searching:", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClientSelect = async (client) => {
        setSelectedClient(client);
        setIsLoading(true);
        try {
            const designs = await base44.entities.BoothDesign.filter({ dealer_id: client.id }, '-created_date', 50);
            setClientProjects(designs);
            setView('client_projects');
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackToSearch = () => {
        setView('search');
        setSelectedClient(null);
        setClientProjects([]);
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 min-h-[500px] flex flex-col">
            
            {/* Header / Search Bar */}
            <div className="mb-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Booth Designer</h1>
                        <p className="text-slate-500">Open an existing project or create a new one</p>
                    </div>
                    <Button onClick={onNewProject} className="bg-[#e2231a] hover:bg-[#b01b13]">
                        <Plus className="w-4 h-4 mr-2" />
                        New Project
                    </Button>
                </div>

                {view === 'search' && (
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <Input 
                            placeholder="Search projects, clients, or companies..." 
                            className="pl-10 h-12 text-lg bg-slate-50 border-slate-200 focus:bg-white transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                    {isLoading ? (
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex items-center justify-center h-40"
                        >
                            <Loader2 className="w-8 h-8 text-[#e2231a] animate-spin" />
                        </motion.div>
                    ) : view === 'search' ? (
                        <motion.div 
                            key="search-results"
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            {/* Projects Section */}
                            <section>
                                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <FolderOpen className="w-4 h-4" />
                                    {searchTerm ? 'Matching Projects' : 'Recent Projects'}
                                </h3>
                                <div className="grid md:grid-cols-2 gap-3">
                                    {projects.length > 0 ? projects.map(project => (
                                        <div 
                                            key={project.id}
                                            onClick={() => onSelectProject(project)}
                                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#e2231a] hover:shadow-md cursor-pointer transition-all group bg-slate-50 dark:bg-slate-800/50"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-semibold text-slate-900 dark:text-white group-hover:text-[#e2231a] transition-colors">
                                                        {project.design_name}
                                                    </h4>
                                                    {project._dealer_company && (
                                                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                                                            <Building className="w-3 h-3" />
                                                            <span className="truncate max-w-[150px]">{project._dealer_company}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5">
                                                        <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                                                            {project.booth_size}
                                                        </span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(project.created_date).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                                {project.design_image_url && (
                                                    <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden">
                                                        <img src={project.design_image_url} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="col-span-full text-center py-8 text-slate-400 italic">
                                            No projects found
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Clients Section (Only show if searching or if needed) */}
                            {(searchTerm || clients.length > 0) && (
                                <section>
                                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        Clients & Contacts
                                    </h3>
                                    <div className="grid md:grid-cols-2 gap-3">
                                        {clients.length > 0 ? clients.map(client => (
                                            <div 
                                                key={client.id}
                                                onClick={() => handleClientSelect(client)}
                                                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#e2231a] hover:shadow-md cursor-pointer transition-all group bg-white dark:bg-slate-900"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-[#e2231a]/10 group-hover:text-[#e2231a]">
                                                        <User className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-slate-900 dark:text-white group-hover:text-[#e2231a]">
                                                            {client.full_name || client.email}
                                                        </h4>
                                                        {client.company_name && (
                                                            <div className="flex items-center gap-1 text-xs text-slate-500">
                                                                <Building className="w-3 h-3" />
                                                                {client.company_name}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="col-span-full text-center py-8 text-slate-400 italic">
                                                No clients found matching "{searchTerm}"
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="client-projects"
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                        >
                            <div className="flex items-center gap-4 mb-6">
                                <Button variant="ghost" size="icon" onClick={handleBackToSearch}>
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                        {selectedClient?.full_name}'s Projects
                                    </h2>
                                    <p className="text-sm text-slate-500">
                                        {selectedClient?.company_name || selectedClient?.email}
                                    </p>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                {clientProjects.length > 0 ? clientProjects.map(project => (
                                    <div 
                                        key={project.id}
                                        onClick={() => onSelectProject(project)}
                                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#e2231a] hover:shadow-md cursor-pointer transition-all bg-white dark:bg-slate-900"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-semibold text-slate-900 dark:text-white">
                                                    {project.design_name}
                                                </h4>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded">
                                                        {project.booth_size}
                                                    </span>
                                                    <span>•</span>
                                                    {new Date(project.created_date).toLocaleDateString()}
                                                </div>
                                            </div>
                                            {project.design_image_url && (
                                                <div className="w-16 h-12 rounded bg-slate-100 overflow-hidden">
                                                    <img src={project.design_image_url} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )) : (
                                    <div className="col-span-full text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-500">No projects found for this client</p>
                                        <Button 
                                            variant="link" 
                                            className="text-[#e2231a]"
                                            onClick={onNewProject}
                                        >
                                            Start a new project for them
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}