import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseSalesUrl = process.env.NEXT_PUBLIC_SUPABASE_SALES_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseSalesKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_SALES || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Only throw error at runtime, not during build
if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseKey)) {
  console.error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
export const supabaseSales = createClient(supabaseSalesUrl, supabaseSalesKey)

export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : createClient(supabaseUrl, supabaseKey) // Fallback to anon key



export const supabaseAdminSales = supabaseServiceKey 
  ? createClient(supabaseSalesUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : createClient(supabaseSalesUrl, supabaseSalesKey) // Fallback to anon key

  export default supabase