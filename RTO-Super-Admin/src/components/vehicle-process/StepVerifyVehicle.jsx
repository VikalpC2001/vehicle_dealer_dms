import { useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Field } from './verifyFields'

/**
 * Step 2 — verify & edit the auto-filled VEHICLE fields. Reads the shared wizard form via
 * `useFormContext()`; the wizard validates these fields with `trigger()` before advancing.
 */
export function StepVerifyVehicle() {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext()

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground">Vehicle</h3>
        <p className="text-xs text-muted-foreground">
          Confirm the auto-filled vehicle details. Registration number is required.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Registration Number" id="registrationNumber" required error={errors.registrationNumber?.message}>
          <Input id="registrationNumber" placeholder="MH12AB1234" {...register('registrationNumber')} />
        </Field>
        <Field label="Registration Date" id="registrationDate" error={errors.registrationDate?.message}>
          <Input id="registrationDate" type="date" {...register('registrationDate')} />
        </Field>
        <Field label="Make" id="make" error={errors.make?.message}>
          <Input id="make" placeholder="Maruti" {...register('make')} />
        </Field>
        <Field label="Model" id="model" error={errors.model?.message}>
          <Input id="model" placeholder="Swift" {...register('model')} />
        </Field>
        <Field label="Chassis Number" id="chassisNumber" error={errors.chassisNumber?.message}>
          <Input id="chassisNumber" placeholder="MBLJF16EDCGA07285" {...register('chassisNumber')} />
        </Field>
        <Field label="Engine Number" id="engineNumber" error={errors.engineNumber?.message}>
          <Input id="engineNumber" placeholder="JF16EBCGA06004" {...register('engineNumber')} />
        </Field>
        <Field label="Vehicle Type" id="vehicleType" error={errors.vehicleType?.message}>
          <Input id="vehicleType" placeholder="Car / Scooter" {...register('vehicleType')} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Mfg. Month" id="manufactureMonth" error={errors.manufactureMonth?.message}>
            <Input
              id="manufactureMonth"
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="6"
              {...register('manufactureMonth')}
              // Write the sanitized value THROUGH the form so RHF state always equals what's shown
              // (register's own onChange would commit the raw value before it could be cleaned).
              onChange={(e) =>
                setValue('manufactureMonth', e.target.value.replace(/\D/g, '').slice(0, 2), {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            />
          </Field>
          <Field label="Mfg. Year" id="manufactureYear" error={errors.manufactureYear?.message}>
            <Input
              id="manufactureYear"
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="2019"
              {...register('manufactureYear')}
              // Write the sanitized value THROUGH the form (see manufactureMonth above).
              onChange={(e) =>
                setValue('manufactureYear', e.target.value.replace(/\D/g, '').slice(0, 4), {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            />
          </Field>
        </div>
      </div>
    </section>
  )
}
