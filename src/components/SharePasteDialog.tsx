import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { deriveShareKey, unwrapPasteKey, wrapPasteKeyForShare } from '@/lib/crypto';
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
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp";

interface SharePasteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pasteSlug: string;
    encryptedPasteKey: string;
    onSuccess: (sharedEncryptedKey: string) => void;
}

export function SharePasteDialog({
    open,
    onOpenChange,
    pasteSlug,
    encryptedPasteKey,
    onSuccess
}: SharePasteDialogProps) {
    const { masterKey } = useAuth();
    const [sharePassword, setSharePassword] = useState('');
    const [shareLoading, setShareLoading] = useState(false);

    const handleShare = async () => {
        if (!masterKey || !encryptedPasteKey || sharePassword.length < 6) return;
        setShareLoading(true);
        try {
            const pasteKey = await unwrapPasteKey(masterKey, encryptedPasteKey);
            const shareKey = await deriveShareKey(sharePassword, pasteSlug);
            const sharedEncryptedKey = await wrapPasteKeyForShare(shareKey, pasteKey);
            
            await api.paste.share(pasteSlug, sharedEncryptedKey);
            
            onSuccess(sharedEncryptedKey);
            onOpenChange(false);
            setSharePassword('');
            
            const url = `${window.location.origin}/paste/${pasteSlug}`;
            await navigator.clipboard.writeText(url);
            toast.success('Paste shared! Link copied to clipboard.');
        } catch (e) {
            console.error('Failed to share paste', e);
            toast.error('Failed to share paste');
        } finally {
            setShareLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>Share Paste</DialogTitle>
                    <DialogDescription>
                        Set a 6-digit PIN that guests will need to enter to view this paste.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 mt-4 flex flex-col items-center">
                    <InputOTP
                        maxLength={6}
                        value={sharePassword}
                        onChange={setSharePassword}
                        disabled={shareLoading}
                    >
                        <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                        </InputOTPGroup>
                    </InputOTP>
                    
                    <div className="flex justify-end gap-2 w-full mt-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button
                            disabled={shareLoading || sharePassword.length < 6}
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
