<script lang="ts">
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { preventDefault } from '$lib/utils/functions/svelte';
  import { t } from '$lib/utils/functions/translations';
  import { courseApi } from '$features/course/api/course.svelte';
  import { profile, user } from '$lib/utils/store/user';
  import getCurrencyFormatter from '$lib/utils/functions/getCurrencyFormatter';

  import * as Dialog from '@cio/ui/base/dialog';
  import { InputField } from '@cio/ui/custom/input-field';
  import { Button } from '@cio/ui/base/button';

  interface Props {
    open?: boolean;
    courseId?: string;
    amount?: number;
    currency?: string;
  }

  let { open = $bindable(false), courseId = '', amount = 0, currency = 'EUR' }: Props = $props();

  type Method = 'multibanco' | 'mbway';
  const STEPS = {
    METHOD: 'method',
    MULTIBANCO: 'multibanco',
    MBWAY: 'mbway',
    SUCCESS: 'success',
    ERROR: 'error'
  } as const;

  let step = $state<string>(STEPS.METHOD);
  let method = $state<Method>('multibanco');
  let phone = $state('');
  let submitting = $state(false);
  let reference = $state<{ entity: string; reference: string } | null>(null);
  let phoneError = $state('');
  let errorMessage = $state('');
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const formatter = $derived(getCurrencyFormatter(currency));
  const amountLabel = $derived(formatter?.format(amount) ?? `${amount}`);

  const POLL_INTERVAL_MS = 4000;

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function onPaid() {
    stopPolling();
    step = STEPS.SUCCESS;
    setTimeout(() => {
      open = false;
      goto(`/courses/${courseId}/lessons?next=true`);
    }, 1600);
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
      const result = await courseApi.verifyEasypayPayment(courseId);
      const status = result?.data?.status;

      if (status === 'paid') {
        onPaid();
      } else if (status === 'failed' || status === 'expired') {
        stopPolling();
        errorMessage = $t('easypay.error.message');
        step = STEPS.ERROR;
      }
    }, POLL_INTERVAL_MS);
  }

  function resetState() {
    stopPolling();
    step = STEPS.METHOD;
    method = 'multibanco';
    phone = '';
    submitting = false;
    reference = null;
    phoneError = '';
    errorMessage = '';
  }

  function handleOpenChange(isOpen: boolean) {
    open = isOpen;

    if (!isOpen) {
      resetState();
    }
  }

  async function handleSubmit() {
    phoneError = '';

    if (!$user.isLoggedIn) {
      errorMessage = $t('easypay.login_required');
      step = STEPS.ERROR;
      return;
    }

    if (method === 'mbway' && !phone.trim()) {
      phoneError = $t('easypay.phone_required');
      return;
    }

    submitting = true;
    const result = await courseApi.createEasypayCheckout(courseId, {
      method,
      phone: method === 'mbway' ? phone.trim() : undefined,
      fullname: $profile.fullname ?? undefined,
      email: $profile.email ?? undefined
    });
    submitting = false;

    if (!result?.data) {
      errorMessage = $t('easypay.error.message');
      step = STEPS.ERROR;
      return;
    }

    const data = result.data;

    if (data.status === 'paid') {
      onPaid();
      return;
    }

    if (method === 'multibanco' && data.multibanco) {
      reference = data.multibanco;
      step = STEPS.MULTIBANCO;
      startPolling();
    } else if (method === 'mbway') {
      step = STEPS.MBWAY;
      startPolling();
    } else {
      errorMessage = $t('easypay.error.message');
      step = STEPS.ERROR;
    }
  }

  onDestroy(stopPolling);
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Content class="w-[26rem]">
    <Dialog.Header>
      <Dialog.Title>{$t('easypay.title')}</Dialog.Title>
      <Dialog.Description>{$t('easypay.subtitle', { amount: amountLabel })}</Dialog.Description>
    </Dialog.Header>

    {#if step === STEPS.METHOD}
      <form onsubmit={preventDefault(handleSubmit)}>
        <div class="mb-4 grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant={method === 'multibanco' ? 'default' : 'secondary'}
            onclick={() => (method = 'multibanco')}
          >
            {$t('easypay.method.multibanco')}
          </Button>
          <Button
            type="button"
            variant={method === 'mbway' ? 'default' : 'secondary'}
            onclick={() => (method = 'mbway')}
          >
            {$t('easypay.method.mbway')}
          </Button>
        </div>

        {#if method === 'mbway'}
          <InputField
            label={$t('easypay.phone_label')}
            bind:value={phone}
            placeholder="912345678"
            className="mb-4"
            isRequired={true}
            autoComplete={false}
            errorMessage={phoneError}
          />
        {/if}

        <div class="mt-5 flex flex-row-reverse items-center">
          <Button type="submit" disabled={submitting}>
            {submitting ? $t('easypay.processing') : $t('easypay.pay_button', { amount: amountLabel })}
          </Button>
        </div>
      </form>
    {:else if step === STEPS.MULTIBANCO}
      <div class="ui:bg-muted rounded-lg p-4">
        <div class="mb-2 flex items-center justify-between">
          <span class="ui:text-muted-foreground text-sm">{$t('easypay.multibanco.entity')}</span>
          <span class="font-mono text-base font-semibold">{reference?.entity}</span>
        </div>
        <div class="mb-2 flex items-center justify-between">
          <span class="ui:text-muted-foreground text-sm">{$t('easypay.multibanco.reference')}</span>
          <span class="font-mono text-base font-semibold">{reference?.reference}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="ui:text-muted-foreground text-sm">{$t('easypay.multibanco.amount')}</span>
          <span class="text-base font-semibold">{amountLabel}</span>
        </div>
      </div>
      <p class="ui:text-muted-foreground mt-4 text-sm">{$t('easypay.multibanco.waiting')}</p>
    {:else if step === STEPS.MBWAY}
      <p class="text-sm">{$t('easypay.mbway.sent', { phone })}</p>
      <p class="ui:text-muted-foreground mt-2 text-sm">{$t('easypay.mbway.waiting')}</p>
    {:else if step === STEPS.SUCCESS}
      <p class="text-base font-semibold">{$t('easypay.success.title')}</p>
      <p class="ui:text-muted-foreground mt-1 text-sm">{$t('easypay.success.message')}</p>
    {:else if step === STEPS.ERROR}
      <p class="text-base font-semibold">{$t('easypay.error.title')}</p>
      <p class="ui:text-muted-foreground mt-1 text-sm">{errorMessage || $t('easypay.error.message')}</p>
      <div class="mt-5 flex flex-row-reverse items-center">
        <Button type="button" onclick={() => resetState()}>{$t('easypay.retry')}</Button>
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
