import { useAuth } from '@clerk/clerk-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { analyzeRequestSchema, type AnalyzeRequest } from '@youno/shared/schemas/analyze';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchAnalyze } from '@/lib/api';

// Dialog modal pour lancer une nouvelle analyse depuis n'importe quelle page.
// Déclenché par le bouton "Nouvelle analyse" dans la sidebar.
interface NewAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewAnalysisDialog({ open, onOpenChange }: NewAnalysisDialogProps) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<AnalyzeRequest>({
    resolver: zodResolver(analyzeRequestSchema),
    defaultValues: { url: '' },
  });

  // Reset form quand le dialog se ferme (pour repartir clean au prochain ouvrir).
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const analyze = useMutation({
    mutationFn: async (values: AnalyzeRequest) => {
      const token = await getToken();
      if (!token) throw new Error('Pas de session active');
      return fetchAnalyze(token, values.url);
    },
    onSuccess: (data) => {
      toast.success(`Analyse de ${data.domain} terminée${data.fromCache ? ' (cache)' : ''}`);
      // Invalide la liste history pour qu'elle recharge la nouvelle analyse
      void queryClient.invalidateQueries({ queryKey: ['history'] });
      onOpenChange(false);
      navigate(`/analysis/${data.id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle analyse</DialogTitle>
          <DialogDescription>
            Colle une URL d'entreprise pour générer une analyse GTM en moins de 30 secondes.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => analyze.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="url">URL du site</Label>
            <Input
              id="url"
              type="text"
              placeholder="stripe.com ou https://stripe.com"
              autoComplete="url"
              autoFocus
              disabled={analyze.isPending}
              {...form.register('url')}
            />
            {form.formState.errors.url && (
              <p className="text-xs text-destructive">{form.formState.errors.url.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={analyze.isPending}>
            {analyze.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyse en cours… (10-30s)
              </>
            ) : (
              'Analyser'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
