import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const error_description = searchParams.get('error_description')
    const next = searchParams.get('next') ?? '/dashboard'

    // Use configured frontend URL or fallback to request origin
    const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || origin;

    if (error) {
        console.log(`Callback: Auth error, redirecting to ${baseUrl}/auth/auth-code-error`);
        return NextResponse.redirect(`${baseUrl}/auth/auth-code-error?error=${encodeURIComponent(error_description || error)}`)
    }

    if (code) {
        const supabase = await createClient()
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
        if (!sessionError) {
            const redirectUrl = `${baseUrl}${next}`;
            console.log(`Callback: Success, redirecting to ${redirectUrl}`);
            return NextResponse.redirect(redirectUrl)
        }
        // If exchange fails, redirect to error page
        const cookieStore = await cookies()
        const cookieNames = cookieStore.getAll().map(c => c.name).join(', ')
        console.log(`Callback: Exchange failed, redirecting to ${baseUrl}/auth/auth-code-error`);
        return NextResponse.redirect(`${baseUrl}/auth/auth-code-error?error=${encodeURIComponent(sessionError.message + " | Cookies: " + cookieNames)}`)
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${baseUrl}/auth/auth-code-error?error=No+code+provided`)
}
