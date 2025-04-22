'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation'
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

// To handle type validation, especially for amount (coerce string to number)
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(['pending', 'paid']),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
    const { customerId, amount, status } = CreateInvoice.parse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });

  // Storing values in cents
  //   It's usually good practice to store monetary values in cents in your database to eliminate JavaScript floating-point errors and ensure greater accuracy.
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try{
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error)
  {
     // We'll log the error to the console for now
        console.error(error);
  }




  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');


        //   const rawFormData = {
        //     customerId: formData.get('customerId'),
        //     amount: formData.get('amount'),
        //     status: formData.get('status'),
        //   };
          // Test it out:
          // You'll notice that amount is of type string and not number.
          //This is because input elements with type="number" actually return a string, not a number!
        //   console.log(rawFormData);
        //   console.log(typeof rawFormData.customerId);
        //   console.log(typeof rawFormData.amount);
        //   console.log(typeof rawFormData.status);
}

export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  const amountInCents = amount * 100;

    try {
      await sql`
          UPDATE invoices
          SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
          WHERE id = ${id}
        `;
    } catch (error) {
      // We'll log the error to the console for now
      console.error(error);
    }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');  // get error
}

export async function deleteInvoice(id: string) {
  //throw new Error('Failed to Delete Invoice');  // comment out to force to test error handling
  // Unreachable code block

  await sql`DELETE FROM invoices WHERE id = ${id}`;
  revalidatePath('/dashboard/invoices');
}