import { redirect } from 'next/navigation';

export default function UserNewRedirectPage() {
  redirect('/admin/users');
}
