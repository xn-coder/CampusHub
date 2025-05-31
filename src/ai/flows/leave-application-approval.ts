// Leave application AI agent.
//
// - leaveApplicationApproval - A function that handles the leave application approval process.
// - LeaveApplicationInput - The input type for the leaveApplicationApproval function.
// - LeaveApplicationOutput - The return type for the leaveApplicationApproval function.

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const LeaveApplicationInputSchema = z.object({
  reason: z.string().describe('The reason for the absence.'),
  medicalNotesDataUri: z
    .string()
    .describe(
      'Medical notes as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' 
    )
    .optional(),
});
export type LeaveApplicationInput = z.infer<typeof LeaveApplicationInputSchema>;

const LeaveApplicationOutputSchema = z.object({
  approved: z.boolean().describe('Whether the leave application is approved or not.'),
  reasoning: z.string().describe('The reasoning behind the approval or rejection.'),
});
export type LeaveApplicationOutput = z.infer<typeof LeaveApplicationOutputSchema>;

export async function leaveApplicationApproval(input: LeaveApplicationInput): Promise<LeaveApplicationOutput> {
  return leaveApplicationApprovalFlow(input);
}

const prompt = ai.definePrompt({
  name: 'leaveApplicationApprovalPrompt',
  input: {schema: LeaveApplicationInputSchema},
  output: {schema: LeaveApplicationOutputSchema},
  prompt: `You are an administrator at a school. A student has submitted a leave application and you need to determine whether it is approved or rejected based on school policy.

School policy:
- Absences due to illness are generally approved, provided a medical note is submitted.
- Other absences are approved on a case by case basis.

Reason for absence: {{{reason}}}

Medical notes: {{#if medicalNotesDataUri}}{{media url=medicalNotesDataUri}}{{else}}No medical notes provided.{{/if}}

Based on the provided information and school policy, determine whether the leave application should be approved. Explain your reasoning.`,
});

const leaveApplicationApprovalFlow = ai.defineFlow(
  {
    name: 'leaveApplicationApprovalFlow',
    inputSchema: LeaveApplicationInputSchema,
    outputSchema: LeaveApplicationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
