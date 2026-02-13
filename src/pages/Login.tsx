import { useState } from 'react';
import { Card, CardBody, CardHeader, Input, Button } from '@heroui/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export function Login() {
    const [passphrase, setPassphrase] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passphrase.trim()) {
            setError('Passphrase is required');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await login(passphrase);
            navigate('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid passphrase');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto px-4 py-20">
            <Card className="border border-divider bg-content1/50 backdrop-blur-sm">
                <CardHeader className="flex flex-col items-center gap-2 pt-8 pb-2">
                    <span className="text-4xl">🔐</span>
                    <h1 className="text-2xl font-bold">Welcome Back</h1>
                    <p className="text-default-500 text-sm text-center">
                        Enter your passphrase to create and manage pastes
                    </p>
                </CardHeader>
                <CardBody className="px-6 pb-8">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <Input
                            type="password"
                            label="Passphrase"
                            placeholder="Enter your secret passphrase"
                            value={passphrase}
                            onValueChange={setPassphrase}
                            isInvalid={!!error}
                            errorMessage={error}
                            variant="bordered"
                            size="lg"
                            autoFocus
                        />
                        <Button
                            type="submit"
                            color="primary"
                            variant="shadow"
                            size="lg"
                            isLoading={loading}
                            className="mt-2"
                        >
                            Login
                        </Button>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
}
