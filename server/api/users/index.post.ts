import { auth } from '~~/lib/auth';
import { addUserRole } from '~~/lib/db/queries/user-role';

export type User = {
  id: number;
  name: string;
  email: string;
  password: string;
  status: 'active' | 'pending' | 'suspended' | 'deleted';
  facultyId?: number;
  roleIds: number[];
  image?: string;
};

export default defineEventHandler(async (event) => {
  const { name, email, password, facultyId, roleIds, image } = await readBody<User>(event);

  const response = await auth.api.signUpEmail({
    body: {
      name,
      email,
      password,
      facultyId,
      image,
    },
  });

  if (response.user && roleIds.length > 0) {
    await Promise.all(roleIds.map(roleId => addUserRole(response.user.id, roleId)));
  }
});
