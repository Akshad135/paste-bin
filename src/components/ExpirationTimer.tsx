import { useEffect, useState } from 'react';
import { timeUntilExpiry } from '@/lib/constants';

interface ExpirationTimerProps {
    expiresAt: string;
    onExpire?: () => void;
}

export function ExpirationTimer({ expiresAt, onExpire }: ExpirationTimerProps) {
    const [timeLeft, setTimeLeft] = useState(timeUntilExpiry(expiresAt));

    useEffect(() => {
        const timer = setInterval(() => {
            const remaining = timeUntilExpiry(expiresAt);
            setTimeLeft(remaining);

            if (remaining === 'Expired' || remaining === '') {
                clearInterval(timer);
                onExpire?.();
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [expiresAt, onExpire]);

    return <span>{timeLeft}</span>;
}
