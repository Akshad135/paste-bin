import React, { useState, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HourglassIcon } from '@/components/ui/animated-hourglass';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
    BURN_ACTION_OPTIONS,
    BURN_UNIT_OPTIONS,
    type BurnAction,
    type BurnUnit,
} from '@/lib/constants';

// ── Trigger options ───────────────────────────────────────────────────
// Unshared pastes can only burn on time (no unlocks possible — no one unlocks them).
// Shared pastes get all four combinations.
const UNSHARED_TRIGGER_OPTIONS = [
    { value: 'off', label: 'Off' },
    { value: 'time', label: 'After time' },
];

const SHARED_TRIGGER_OPTIONS = [
    { value: 'off', label: 'Off' },
    { value: 'time', label: 'After time' },
    { value: 'unlock_count', label: 'After unlocks' },
];

interface BurnRulesControlProps {
    burnTrigger: string;
    setBurnTrigger: (value: string) => void;
    burnValue: string;
    setBurnValue: (value: string) => void;
    burnUnit: BurnUnit;
    setBurnUnit: (value: BurnUnit) => void;
    burnUnlocks: string;
    setBurnUnlocks: (value: string) => void;
    burnAction: BurnAction;
    setBurnAction: (value: BurnAction) => void;
    /** When false (default), only time-based burning is available.
     *  When true (shared paste being edited), all four trigger+action combos are shown. */
    isShared?: boolean;
}

function actionLabel(action: BurnAction): string {
    return action === 'revoke_share' ? 'Revoke' : 'Delete';
}

function unitLabel(unit: BurnUnit): string {
    if (unit === 'minute') return 'min';
    return unit;
}

function summaryLabel(trigger: string, action: BurnAction, value: string, unit: BurnUnit, unlocks: string): string {
    if (trigger === 'time') {
        if (!value) return `${actionLabel(action)} after time`;
        return `${actionLabel(action)} after ${value} ${unitLabel(unit)}`;
    }
    if (trigger === 'unlock_count') {
        if (!unlocks) return `${actionLabel(action)} after unlocks`;
        return `${actionLabel(action)} after ${unlocks} unlock${unlocks === '1' ? '' : 's'}`;
    }
    return 'Off';
}

/* ── Shared form body ───────────────────────────────────────────────── */

function BurnRulesFormBody({
    burnTrigger,
    setBurnTrigger,
    burnValue,
    setBurnValue,
    burnUnit,
    setBurnUnit,
    burnUnlocks,
    setBurnUnlocks,
    burnAction,
    setBurnAction,
    isShared = false,
}: BurnRulesControlProps) {
    const triggerOptions = isShared ? SHARED_TRIGGER_OPTIONS : UNSHARED_TRIGGER_OPTIONS;

    return (
        <div className="grid gap-3">
            <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Trigger</Label>
                <Select
                    value={burnTrigger}
                    onValueChange={(value) => {
                        setBurnTrigger(value);
                        // Default action: shared pastes default to revoke on unlock-count,
                        // everything else defaults to delete.
                        setBurnAction(value === 'unlock_count' ? 'revoke_share' : 'delete');
                    }}
                >
                    <SelectTrigger className="h-9 bg-background shadow-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {triggerOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {burnTrigger === 'time' && (
                <div className="grid grid-cols-1 min-[340px]:grid-cols-[1fr_7rem] gap-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">After</Label>
                        <Input
                            type="number"
                            min="1"
                            value={burnValue}
                            onChange={(e) => setBurnValue(e.target.value)}
                            placeholder="Amount"
                            className="h-9 bg-background shadow-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Unit</Label>
                        <Select value={burnUnit} onValueChange={(value) => setBurnUnit(value as BurnUnit)}>
                            <SelectTrigger className="h-9 bg-background shadow-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {BURN_UNIT_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {burnTrigger === 'unlock_count' && (
                <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Successful unlocks</Label>
                    <Input
                        type="number"
                        min="1"
                        value={burnUnlocks}
                        onChange={(e) => setBurnUnlocks(e.target.value)}
                        placeholder="Unlocks"
                        className="h-9 bg-background shadow-sm"
                    />
                </div>
            )}

            {/* Action selector — only visible on shared pastes where it is meaningful */}
            {isShared && burnTrigger !== 'off' && (
                <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Action</Label>
                    <Select value={burnAction} onValueChange={(value) => setBurnAction(value as BurnAction)}>
                        <SelectTrigger className="h-9 bg-background shadow-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {BURN_ACTION_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
}

/* ── Trigger button (shared) ────────────────────────────────────────── */

const BurnRulesTriggerButton = forwardRef<
    HTMLButtonElement,
    { burnTrigger: string; summary: string } & React.ComponentPropsWithoutRef<typeof Button>
>(({ burnTrigger, summary, ...props }, ref) => (
    <Button
        ref={ref}
        type="button"
        variant={burnTrigger === 'off' ? 'outline' : 'secondary'}
        className="h-9 w-auto max-w-full justify-start gap-2 px-3 text-sm shadow-sm"
        title="Configure Burn Rules"
        {...props}
    >
        <HourglassIcon size={14} className={burnTrigger === 'off' ? 'text-muted-foreground' : 'text-amber-500'} />
        <span className="text-muted-foreground">Burn</span>
        <span className="min-w-0 max-w-[9rem] truncate font-medium text-foreground sm:max-w-[11rem]">{summary}</span>
    </Button>
));
BurnRulesTriggerButton.displayName = 'BurnRulesTriggerButton';

/* ── Main component ─────────────────────────────────────────────────── */

export function BurnRulesControl(props: BurnRulesControlProps) {
    const { burnTrigger, setBurnTrigger, burnAction, burnValue, burnUnit, burnUnlocks,
            setBurnAction, setBurnValue, setBurnUnlocks, isShared = false } = props;
    const summary = summaryLabel(burnTrigger, burnAction, burnValue, burnUnit, burnUnlocks);
    const isDesktop = useMediaQuery('(min-width: 640px)');
    const [open, setOpen] = useState(false);

    // Reset ALL burn fields when the user turns burn rules off, so stale values
    // (e.g. a leftover 'revoke_share' action) can't silently carry over the next
    // time a trigger is selected.
    const handleOff = () => {
        setBurnTrigger('off');
        setBurnAction('delete');
        setBurnValue('');
        setBurnUnlocks('1');
    };

    // Contextual description depends on whether the paste is shared.
    const description = isShared
        ? 'Burn after time, or after a number of share link unlocks.'
        : 'Burn this paste automatically after a set amount of time.';

    /* ── Desktop: Popover ────────────────────────────────────────────── */
    if (isDesktop) {
        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <BurnRulesTriggerButton burnTrigger={burnTrigger} summary={summary} />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[26rem] p-4">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold">Burn Rules</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={handleOff}
                            >
                                Off
                            </Button>
                        </div>
                        <BurnRulesFormBody {...props} isShared={isShared} />
                    </div>
                </PopoverContent>
            </Popover>
        );
    }

    /* ── Mobile: Drawer (bottom sheet) ───────────────────────────────── */
    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                <BurnRulesTriggerButton burnTrigger={burnTrigger} summary={summary} />
            </DrawerTrigger>
            <DrawerContent>
                <DrawerHeader className="text-left">
                    <div className="flex items-center justify-between">
                        <DrawerTitle className="text-base">Burn Rules</DrawerTitle>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={handleOff}
                        >
                            Off
                        </Button>
                    </div>
                    <DrawerDescription>
                        {description}
                    </DrawerDescription>
                </DrawerHeader>
                <div className="px-4 pb-2">
                    <BurnRulesFormBody {...props} isShared={isShared} />
                </div>
                <div className="p-4 pt-2">
                    <DrawerClose asChild>
                        <Button variant="outline" className="w-full">
                            Done
                        </Button>
                    </DrawerClose>
                </div>
            </DrawerContent>
        </Drawer>
    );
}