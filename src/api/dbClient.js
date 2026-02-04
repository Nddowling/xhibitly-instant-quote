import { supabase, getBase44UserId } from './supabaseClient';
import { base44 } from './base44Client';

/**
 * Database Entity Wrapper
 * Provides a Base44-compatible API that routes to Supabase
 * This allows minimal code changes when migrating from Base44 entities to Supabase
 */
class EntityWrapper {
  constructor(tableName) {
    this.table = tableName;
  }

  /**
   * List all records from the table
   * Compatible with: base44.entities.Product.list()
   */
  async list() {
    try {
      const { data, error } = await supabase
        .from(this.table)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`Error listing ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Filter records with conditions
   * Compatible with: base44.entities.Product.filter({is_active: true})
   * @param {Object} filters - Key-value pairs to filter by
   * @param {String} orderBy - Optional ordering (e.g., '-created_at' for DESC)
   */
  async filter(filters = {}, orderBy = null) {
    try {
      let query = supabase.from(this.table).select('*');

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          query = query.eq(key, value);
        }
      });

      // Apply ordering
      if (orderBy) {
        const isDesc = orderBy.startsWith('-');
        const field = isDesc ? orderBy.slice(1) : orderBy;
        query = query.order(field, { ascending: !isDesc });
      } else {
        // Default to created_at DESC
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`Error filtering ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Create a new record
   * Compatible with: base44.entities.Order.create({...data})
   * @param {Object} data - Record data to insert
   */
  async create(data) {
    try {
      const { data: result, error } = await supabase
        .from(this.table)
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      console.error(`Error creating ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing record
   * @param {String} id - Record ID
   * @param {Object} data - Data to update
   */
  async update(id, data) {
    try {
      const { data: result, error } = await supabase
        .from(this.table)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      console.error(`Error updating ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Delete a record
   * @param {String} id - Record ID
   */
  async delete(id) {
    try {
      const { error } = await supabase
        .from(this.table)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error(`Error deleting ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Get a single record by ID
   * @param {String} id - Record ID
   */
  async get(id) {
    try {
      const { data, error } = await supabase
        .from(this.table)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error getting ${this.table}:`, error);
      throw error;
    }
  }
}

/**
 * Database client with entity wrappers
 * Provides Supabase access with Base44-compatible API
 */
export const db = {
  // Entity wrappers for Supabase tables
  entities: {
    Product: new EntityWrapper('products'),
    BoothDesign: new EntityWrapper('booth_designs'),
    Order: new EntityWrapper('orders'),
    Profile: new EntityWrapper('profiles'),
    Company: new EntityWrapper('companies'),
    SalesRep: new EntityWrapper('sales_reps')
  },

  // Keep Base44 auth methods (auth stays with Base44)
  auth: {
    async isAuthenticated() {
      return await base44.auth.isAuthenticated();
    },
    async me() {
      return await base44.auth.me();
    },
    async updateMe(updates) {
      return await base44.auth.updateMe(updates);
    },
    async logout() {
      return await base44.auth.logout();
    },
    redirectToLogin(redirectUrl) {
      return base44.auth.redirectToLogin(redirectUrl);
    }
  },

  // Keep Base44 integrations (LLM and email stay with Base44 for now)
  integrations: {
    Core: {
      async InvokeLLM(params) {
        return await base44.integrations.Core.InvokeLLM(params);
      },
      async SendEmail(params) {
        return await base44.integrations.Core.SendEmail(params);
      }
    }
  }
};

// Export as default for easy migration
export default db;
