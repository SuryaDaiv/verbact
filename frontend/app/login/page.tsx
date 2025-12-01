import AuthForm from '@/components/AuthForm'

export default function LoginPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center py-2 bg-gray-50">
            <div className="w-full max-w-md space-y-8 px-4 sm:px-6 bg-white p-8 rounded-xl shadow-lg">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
                        Welcome to Verbact
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Sign in to your account to save your recordings
                    </p>
                </div>
                <AuthForm />
            </div>
        </div>
    )
}
