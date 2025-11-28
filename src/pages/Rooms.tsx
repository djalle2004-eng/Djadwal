import React, { useState, useEffect } from 'react';
import { read, utils, writeFile } from 'xlsx';
import { usePermissions } from '../hooks/usePermissions';
// تعليق استيرادات Firebase
// import { db } from '../lib/firebase';
// import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

// استخدام نفس واجهة Room المعرفة في database.d.ts
interface Room {
  id: number;
  name: string;
  capacity?: number;
  created_at?: string;
}

// واجهة نموذج الإدخال
interface RoomFormData {
  name: string;
  capacity: number;
}

// واجهة أخطاء النموذج
interface FormErrors {
  name?: string;
  capacity?: string;
}

export default function Rooms() {
  const { can } = usePermissions();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState<RoomFormData>({
    name: '',
    capacity: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      // استخدام SQLite بدلاً من Firebase
      const roomsData = await window.db.getRooms();
      setRooms(roomsData);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setError('Failed to fetch rooms');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): FormErrors => {
    const errors: FormErrors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    if (formData.capacity <= 0) {
      errors.capacity = 'Capacity must be greater than 0';
    }

    setFormErrors(errors);
    return errors;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'capacity' ? parseInt(value) || 0 : value
    }));
    setFormErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      name: room.name,
      capacity: room.capacity || 0
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm();
    
    if (Object.keys(errors).length === 0) {
      try {
        if (editingRoom) {
          // تحديث البيانات باستخدام SQLite
          await window.db.updateRoom(
            editingRoom.id, 
            formData.name, 
            formData.capacity
          );
        } else {
          // إضافة بيانات جديدة باستخدام SQLite
          await window.db.addRoom(
            formData.name,
            formData.capacity
          );
        }

        setFormData({
          name: '',
          capacity: 0
        });
        setEditingRoom(null);
        setIsModalOpen(false);
        fetchRooms();
      } catch (error) {
        console.error('Error saving room:', error);
        setError('Failed to save room');
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this room?')) {
      try {
        // حذف البيانات باستخدام SQLite
        await window.db.deleteRoom(id);
        fetchRooms();
      } catch (error) {
        console.error('Error deleting room:', error);
        setError('Failed to delete room');
      }
    }
  };

  // Excel Export Function
  const handleExport = () => {
    const worksheet = utils.json_to_sheet(rooms.map(room => ({
      Name: room.name,
      Capacity: room.capacity || 0
    })));

    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Rooms');
    writeFile(workbook, 'rooms.xlsx');
  };

  // Excel Import Function
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = utils.sheet_to_json(worksheet) as Record<string, any>[];

        for (const row of jsonData) {
          const roomData = {
            name: String(row['Name'] || ''),
            capacity: Number(row['Capacity']) || 0
          };

          // Validate required fields
          if (!roomData.name) {
            throw new Error('Name is a required field');
          }

          // استخدام SQLite للتحقق من وجود الغرفة
          const roomsData = await window.db.getRooms();
          const existingRoom = roomsData.find(r => r.name === roomData.name);

          if (existingRoom) {
            // تحديث الغرفة الموجودة
            await window.db.updateRoom(
              existingRoom.id,
              roomData.name,
              roomData.capacity
            );
          } else {
            // إضافة غرفة جديدة
            await window.db.addRoom(
              roomData.name,
              roomData.capacity
            );
          }
        }

        // Refresh the rooms list
        fetchRooms();
        alert('Rooms imported successfully!');
      } catch (err) {
        console.error('Error importing rooms:', err);
        alert(err instanceof Error ? err.message : 'Error importing rooms. Please check the file format and try again.');
      }
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-4 flex gap-2">
        <button
          onClick={handleExport}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Export to Excel
        </button>
        <label className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 cursor-pointer">
          Import from Excel
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImport}
            className="hidden"
          />
        </label>
      </div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Rooms</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all rooms including their capacity.
          </p>
        </div>
        {can('create', 'rooms') && (
          <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Add Room
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            {loading ? (
              <div className="text-center">Loading rooms...</div>
            ) : error ? (
              <div className="text-center text-red-600">{error}</div>
            ) : rooms.length === 0 ? (
              <div className="text-center text-gray-500">No rooms found</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                      Room Name
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Capacity
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rooms.map((room) => (
                    <tr key={room.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                        {room.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {room.capacity}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                        {can('update', 'rooms') && (
                          <button 
                            onClick={() => handleEdit(room)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            Edit
                          </button>
                        )}
                        {can('delete', 'rooms') && (
                          <button 
                            onClick={() => handleDelete(room.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        )}
                        {!can('update', 'rooms') && !can('delete', 'rooms') && (
                          <span className="text-gray-400">View Only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Room Modal */}
      {isModalOpen && (
        <>
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <div className="mt-3 text-center sm:mt-5">
                    <h3 className="text-base font-semibold leading-6 text-gray-900">
                      {editingRoom ? 'Edit Room' : 'Add New Room'}
                    </h3>
                    {error && (
                      <div className="mt-2 rounded-md bg-red-50 p-4">
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    )}
                    <form onSubmit={handleSubmit} className="mt-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="text-left">
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                            Room Name
                          </label>
                          <input
                            type="text"
                            name="name"
                            id="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                              formErrors.name 
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                            }`}
                            required
                          />
                          {formErrors.name && (
                            <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                          )}
                        </div>
                        <div className="text-left">
                          <label htmlFor="capacity" className="block text-sm font-medium text-gray-700">
                            Capacity
                          </label>
                          <input
                            type="number"
                            name="capacity"
                            id="capacity"
                            value={formData.capacity}
                            onChange={handleInputChange}
                            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                              formErrors.capacity 
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                            }`}
                            required
                            min="1"
                          />
                          {formErrors.capacity && (
                            <p className="mt-1 text-sm text-red-600">{formErrors.capacity}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                        <button
                          type="submit"
                          className="inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm bg-indigo-600 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                          {editingRoom ? 'Update Room' : 'Add Room'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsModalOpen(false);
                            setEditingRoom(null);
                            setFormData({
                              name: '',
                              capacity: 0
                            });
                            setFormErrors({});
                          }}
                          className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}