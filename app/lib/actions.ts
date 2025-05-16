'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation'
import postgres from 'postgres';
import { signIn } from '@/app/auth';
import { AuthError } from 'next-auth';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

// To handle type validation, especially for amount (coerce string to number)
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
      invalid_type_error: 'Please select a customer.',
    }),
  amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
      invalid_type_error: 'Please select an invoice status.',
    }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
    //const { customerId, amount, status } = CreateInvoice.parse({  // use parse to set datatype for properties
    const validatedFields = CreateInvoice.safeParse({  // change to safeParse for form validation, safeParse() will return an object containing either a success or error field. This will help handle validation more gracefully without having put this logic inside the try/catch block.
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });

    // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to Create Invoice.',
      };
    }


  // Storing values in cents
  //   It's usually good practice to store monetary values in cents in your database to eliminate JavaScript floating-point errors and ensure greater accuracy.
  // Prepare data for insertion into the database
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  // Insert data into the database
  try{
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error)
  {
     // We'll log the error to the console for now
        console.error(error);

     // If a database error occurs, return a more specific error.
     return {
       message: 'Database Error: Failed to Create Invoice.',
     };
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

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData,
) {

  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

    if (!validatedFields.success) {
      return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to Update Invoice.',
      };
    }

  const { customerId, amount, status } = validatedFields.data;
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

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
         const result = await signIn('credentials', formData);

//            if (result?.error === 'CredentialsSignin') {
//              return 'Invalid credentials.';
//            }
//
//            if (result?.error) {
//              return 'Something went wrong.';
//            }

           return undefined;

        // ** Should NOT use try/catch for await signIn()
        // ** from chatGPT "If you're seeing it in a thrown error, it's likely because you're catching the redirect. Simply remove the try/catch block if you're allowing login to redirect on success."
        //       try {
        //         await signIn('credentials', formData);
        //       } catch (error: any) {
        //          if (error?.message === 'Invalid credentials') {
        //               return 'Invalid credentials.';
        //          }
        //
        //          console.log('error in authenticate: ', error);
        //          return 'Something went wrong.';
        //       }
}