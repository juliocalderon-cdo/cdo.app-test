import React, { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../hooks/useAuth';
import { User, UserRole } from '../types';
import { RefreshIcon } from './Icons';

type UserModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: User) => void;
    userToEdit: User | null;
};

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, onSave, userToEdit }: UserModalProps) => {
    const [formData, setFormData] = useState<User>({ username: '', name: '', role: UserRole.OPERADOR_IMPO, password: '', email: '' });
    const isEditMode = !!userToEdit;

    useEffect(() => {
        if (isOpen) {
            const initialData = userToEdit 
                ? { ...userToEdit, password: '' } 
                : { username: '', name: '', role: UserRole.OPERADOR_IMPO, password: '', email: '' };
            setFormData(initialData);
        }
    }, [userToEdit, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-zinc-800 rounded-lg shadow-2xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <h3 className="text-xl font-bold text-white">{isEditMode ? 'Editar Usuario' : 'Añadir Nuevo Usuario'}</h3>
                        <div className="space-y-4 mt-4">
                            <div>
                                <label htmlFor="username" className="block text-sm font-medium text-zinc-300">Nombre de Usuario</label>
                                <input 
                                    type="text" 
                                    name="username" 
                                    id="username" 
                                    value={formData.username} 
                                    onChange={handleChange} 
                                    required 
                                    disabled={isEditMode}
                                    className="mt-1 w-full px-3 py-2 border border-zinc-600 rounded-lg bg-zinc-700 disabled:bg-zinc-600 disabled:opacity-70" 
                                />
                            </div>
                             <div>
                                <label htmlFor="name" className="block text-sm font-medium text-zinc-300">Nombre Completo</label>
                                <input 
                                    type="text" 
                                    name="name" 
                                    id="name" 
                                    value={formData.name} 
                                    onChange={handleChange} 
                                    required 
                                    className="mt-1 w-full px-3 py-2 border border-zinc-600 rounded-lg bg-zinc-700" 
                                />
                            </div>
                             <div>
                                <label htmlFor="email" className="block text-sm font-medium text-zinc-300">Email (Opcional)</label>
                                <input 
                                    type="email" 
                                    name="email" 
                                    id="email" 
                                    value={formData.email} 
                                    onChange={handleChange} 
                                    className="mt-1 w-full px-3 py-2 border border-zinc-600 rounded-lg bg-zinc-700" 
                                />
                            </div>
                             <div>
                                <label htmlFor="password" className="block text-sm font-medium text-zinc-300">Contraseña</label>
                                <input 
                                    type="password" 
                                    name="password" 
                                    id="password" 
                                    value={formData.password} 
                                    onChange={handleChange} 
                                    required={!isEditMode}
                                    placeholder={isEditMode ? 'Dejar en blanco para no cambiar' : ''}
                                    className="mt-1 w-full px-3 py-2 border border-zinc-600 rounded-lg bg-zinc-700" 
                                />
                            </div>
                            <div>
                                <label htmlFor="role" className="block text-sm font-medium text-zinc-300">Rol</label>
                                <select name="role" id="role" value={formData.role} onChange={handleChange} className="mt-1 w-full px-3 py-2 border border-zinc-600 rounded-lg bg-zinc-700">
                                    <option value={UserRole.OPERADOR_IMPO}>Operador IMPO</option>
                                    <option value={UserRole.MONITOR_IMPO}>Monitor IMPO</option>
                                    <option value={UserRole.TRANSPORTE}>Transporte</option>
                                    <option value={UserRole.FRESCOS}>Frescos</option>
                                    <option value={UserRole.CALIDAD}>Calidad</option>
                                    <option value={UserRole.ADMIN}>Administrador</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-zinc-700/50 flex justify-end gap-3 rounded-b-lg">
                        <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-600 rounded-md border border-zinc-600">Cancelar</button>
                        <button type="submit" className="px-5 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const DeleteConfirmationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    username?: string;
}> = ({ isOpen, onClose, onConfirm, username }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, username?: string }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-zinc-800 rounded-lg shadow-2xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h3 className="text-xl font-bold text-white">Confirmar Eliminación</h3>
                    <p className="mt-4 text-zinc-400">
                        ¿Está seguro que desea revocar el acceso al usuario <span className="font-bold text-red-500">{username}</span>?
                    </p>
                    <p className="mt-2 text-sm text-yellow-400">Esta acción no se puede deshacer.</p>
                </div>
                <div className="p-4 bg-zinc-700/50 flex justify-end gap-3 rounded-b-lg">
                    <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-medium rounded-md border border-zinc-600">Cancelar</button>
                    <button type="button" onClick={onConfirm} className="px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md">Eliminar Acceso</button>
                </div>
            </div>
        </div>
    );
};

export const UserManagement: React.FC = () => {
    const { getUsers, addUser, updateUser, deleteUser } = useAuthContext();
    const [userList, setUserList] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedUsers = await getUsers();
            setUserList(fetchedUsers);
        } catch (error) {
            console.error("Failed to fetch users:", error);
            alert("No se pudieron cargar los usuarios.");
        } finally {
            setIsLoading(false);
        }
    }, [getUsers]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleOpenCreateModal = () => {
        setUserToEdit(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (user: User) => {
        setUserToEdit(user);
        setIsModalOpen(true);
    };

    const handleSaveUser = async (data: User) => {
        try {
            if (userToEdit) { // Editing
                await updateUser(data);
            } else { // Creating
                await addUser(data);
            }
            setIsModalOpen(false);
            fetchUsers(); // Refresh list
        } catch (err) {
            if (err instanceof Error) alert(err.message);
        }
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        try {
            await deleteUser(userToDelete.username);
            setUserToDelete(null);
            fetchUsers(); // Refresh list
        } catch (err) {
            if (err instanceof Error) alert(err.message);
        }
    };
    
    return (
        <div className="p-6 sm:p-8">
            <UserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveUser} userToEdit={userToEdit} />
            <DeleteConfirmationModal isOpen={!!userToDelete} onClose={() => setUserToDelete(null)} onConfirm={handleDeleteUser} username={userToDelete?.username} />

            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-extrabold text-white">Gestión de Usuarios</h1>
                <div className="flex items-center gap-4">
                    <button
                        onClick={fetchUsers}
                        className="p-3 rounded-lg bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-600"
                        disabled={isLoading}
                        title="Actualizar lista de usuarios"
                    >
                        <RefreshIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={handleOpenCreateModal} className="bg-sky-600 text-white font-bold py-3 px-5 rounded-lg hover:bg-sky-700 transition-colors text-base">
                        Añadir Usuario
                    </button>
                </div>
            </div>
            <div className="bg-zinc-800 rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    {isLoading ? (
                        <p className="p-6 text-center text-zinc-500">Cargando usuarios...</p>
                    ) : (
                    <table className="w-full text-sm text-left text-zinc-400">
                        <thead className="text-xs text-zinc-400 uppercase bg-zinc-700">
                            <tr>
                                <th scope="col" className="px-6 py-3">Nombre de Usuario</th>
                                <th scope="col" className="px-6 py-3">Nombre</th>
                                <th scope="col" className="px-6 py-3">Rol</th>
                                <th scope="col" className="px-6 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {userList.map((user: User) => (
                                <tr key={user.username} className="bg-zinc-800 border-b border-zinc-700 hover:bg-zinc-600/50">
                                    <td className="px-6 py-4 font-medium text-white">{user.username}</td>
                                     <td className="px-6 py-4 text-zinc-200">{user.name}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                            user.role === UserRole.ADMIN ? 'bg-green-900 text-green-300' 
                                            : user.role === UserRole.MONITOR_IMPO ? 'bg-purple-900 text-purple-300' 
                                            : user.role === UserRole.TRANSPORTE ? 'bg-amber-900 text-amber-300'
                                            : user.role === UserRole.FRESCOS ? 'bg-teal-900 text-teal-300'
                                            : user.role === UserRole.CALIDAD ? 'bg-rose-900 text-rose-300'
                                            : 'bg-blue-900 text-blue-300'
                                        }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                        <button onClick={() => handleOpenEditModal(user)} className="font-medium text-sky-400 hover:underline mr-4">Editar</button>
                                        <button onClick={() => setUserToDelete(user)} className="font-medium text-red-500 hover:underline">Revocar Acceso</button>
                                    </td>
                                </tr>
                            ))}
                             {userList.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="text-center p-6 text-zinc-500">No hay usuarios configurados.</td>
                                </tr>
                             )}
                        </tbody>
                    </table>
                    )}
                </div>
            </div>
        </div>
    );
};