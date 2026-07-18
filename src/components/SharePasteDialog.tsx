import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { generateAccessCode, deriveShareSecrets, unwrapPasteKey, wrapPasteKeyForShare } from '@/lib/crypto';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';

// PBKDF2 iterations for the server-side slow hash verifier.
// Must match the constant in src-rust/routes/paste.rs (PBKDF2_ITERS = 200_000).
const SERVER_PBKDF2_ITERS = 200_000;

interface SharePasteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pasteSlug: string;
    encryptedPasteKey: string;
    onSuccess: (shareWrappedPasteKey: string) => void;
    burnAction?: 'revoke_share' | 'delete';
}

export function SharePasteDialog({
    open,
    onOpenChange,
    pasteSlug,
    encryptedPasteKey,
    onSuccess,
    burnAction
}: SharePasteDialogProps) {
    const { masterKey } = useAuth();
    const [accessCode, setAccessCode] = useState('');
    const [shareLoading, setShareLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Generate a fresh access code whenever the dialog opens
    useEffect(() => {
        if (open) {
            setAccessCode(generateAccessCode());
            setCopied(false);
        }
    }, [open]);

    const handleCopyCode = async () => {
        await navigator.clipboard.writeText(accessCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        if (!masterKey || !encryptedPasteKey || accessCode.length < 8) return;
        setShareLoading(true);
        try {
            // 1. Unwrap the paste key using the owner master key
            const pasteKey = await unwrapPasteKey(masterKey, encryptedPasteKey);

            // 2. Derive the two separate secrets from the access code
            //    - unlockKey: AES key to wrap the paste key (never leaves browser)
            //    - authSecret: sent to server; server hashes it to make the verifier
            const { unlockKey, authSecret } = await deriveShareSecrets(accessCode, pasteSlug);

            // 3. Wrap the paste key with the unlockKey
            const shareWrappedPasteKey = await wrapPasteKeyForShare(unlockKey, pasteKey);

            // 4. Compute the server-side verifier:
            //    Generate a random 16-byte salt, then compute
            //    PBKDF2-SHA256(authSecret, salt, 200_000 iters) → hex string.
            //    The server stores {salt, verifier} and re-derives on unlock.
            const saltBytes = crypto.getRandomValues(new Uint8Array(16));
            const shareAuthSalt = Array.from(saltBytes)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(authSecret),
                'PBKDF2',
                false,
                ['deriveBits'],
            );
            const verifierBits = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt: saltBytes as unknown as ArrayBuffer,
                    iterations: SERVER_PBKDF2_ITERS,
                    hash: 'SHA-256',
                },
                keyMaterial,
                256,
            );
            const shareAuthVerifier = Array.from(new Uint8Array(verifierBits))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            // 5. Send everything to the server
            await api.paste.share(pasteSlug, shareWrappedPasteKey, shareAuthSalt, shareAuthVerifier);

            onSuccess(shareWrappedPasteKey);

            toast.success('Paste shared!');

            onOpenChange(false);
        } catch (e) {
            console.error('Failed to share paste', e);
            toast.error('Failed to share paste');
        } finally {
            setShareLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md p-4 sm:p-6" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>Share Paste</DialogTitle>
                    <DialogDescription>
                        An access code has been generated. Share the link and this code
                        with your recipient.{burnAction === 'revoke_share' ? ' The access code will revoke automatically when the burn rule is met.' : ''}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 mt-2">
                    {/* Access code display */}
                    <div className="rounded-lg border bg-muted/50 p-2 min-[330px]:p-3 min-[380px]:p-4">
                        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                            Access Code
                        </p>
                        <div className="flex flex-col items-center gap-4 py-2">
                            <InputOTP maxLength={8} value={accessCode} readOnly>
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} className="font-mono text-sm min-[330px]:text-base min-[380px]:text-lg h-7 w-5 min-[330px]:h-9 min-[330px]:w-7 min-[380px]:h-10 min-[380px]:w-8 sm:h-12 sm:w-10" />
                                    <InputOTPSlot index={1} className="font-mono text-sm min-[330px]:text-base min-[380px]:text-lg h-7 w-5 min-[330px]:h-9 min-[330px]:w-7 min-[380px]:h-10 min-[380px]:w-8 sm:h-12 sm:w-10" />
                                    <InputOTPSlot index={2} className="font-mono text-sm min-[330px]:text-base min-[380px]:text-lg h-7 w-5 min-[330px]:h-9 min-[330px]:w-7 min-[380px]:h-10 min-[380px]:w-8 sm:h-12 sm:w-10" />
                                    <InputOTPSlot index={3} className="font-mono text-sm min-[330px]:text-base min-[380px]:text-lg h-7 w-5 min-[330px]:h-9 min-[330px]:w-7 min-[380px]:h-10 min-[380px]:w-8 sm:h-12 sm:w-10" />
                                </InputOTPGroup>
                                <InputOTPSeparator />
                                <InputOTPGroup>
                                    <InputOTPSlot index={4} className="font-mono text-sm min-[330px]:text-base min-[380px]:text-lg h-7 w-5 min-[330px]:h-9 min-[330px]:w-7 min-[380px]:h-10 min-[380px]:w-8 sm:h-12 sm:w-10" />
                                    <InputOTPSlot index={5} className="font-mono text-sm min-[330px]:text-base min-[380px]:text-lg h-7 w-5 min-[330px]:h-9 min-[330px]:w-7 min-[380px]:h-10 min-[380px]:w-8 sm:h-12 sm:w-10" />
                                    <InputOTPSlot index={6} className="font-mono text-sm min-[330px]:text-base min-[380px]:text-lg h-7 w-5 min-[330px]:h-9 min-[330px]:w-7 min-[380px]:h-10 min-[380px]:w-8 sm:h-12 sm:w-10" />
                                    <InputOTPSlot index={7} className="font-mono text-sm min-[330px]:text-base min-[380px]:text-lg h-7 w-5 min-[330px]:h-9 min-[330px]:w-7 min-[380px]:h-10 min-[380px]:w-8 sm:h-12 sm:w-10" />
                                </InputOTPGroup>
                            </InputOTP>
                            <Button
                                variant="secondary"
                                className="w-full max-w-[200px]"
                                onClick={handleCopyCode}
                            >
                                {copied ? 'Copied to clipboard!' : 'Copy Code'}
                            </Button>
                        </div>

                    </div>

                    <div className="flex flex-col-reverse min-[350px]:flex-row justify-center gap-2 mt-4 sm:mt-0 w-full">
                        <Button variant="outline" className="w-full min-[350px]:w-auto" onClick={() => onOpenChange(false)} disabled={shareLoading}>
                            Cancel
                        </Button>
                        <Button
                            className="w-full min-[350px]:w-auto"
                            disabled={shareLoading}
                            onClick={handleShare}
                        >
                            {shareLoading ? 'Sharing...' : 'Share Paste'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
