// تحديث الدالة fetchGroups للتعامل مع قاعدة البيانات المحلية
const fetchGroups = async () => {
  setIsLoading(true);
  try {
    const groups = await window.db.getGroups();
    setGroups(groups);
  } catch (error) {
    console.error("Error fetching groups:", error);
    setError(error instanceof Error ? error.message : "خطأ أثناء جلب المجموعات");
  } finally {
    setIsLoading(false);
  }
};

// تحديث الدالة handleAddGroup للتعامل مع قاعدة البيانات المحلية
const handleAddGroup = async () => {
  if (!newGroupName.trim()) {
    setError("يرجى إدخال اسم المجموعة");
    return;
  }

  try {
    await window.db.addGroup(newGroupName);
    setNewGroupName("");
    fetchGroups();
  } catch (error) {
    console.error("Error adding group:", error);
    setError(error instanceof Error ? error.message : "خطأ أثناء إضافة المجموعة");
  }
};

// تحديث الدالة handleUpdateGroup للتعامل مع قاعدة البيانات المحلية
const handleUpdateGroup = async (id: number, newName: string) => {
  try {
    await window.db.updateGroup(id, newName);
    fetchGroups();
  } catch (error) {
    console.error("Error updating group:", error);
    setError(error instanceof Error ? error.message : "خطأ أثناء تحديث المجموعة");
  }
};

// تحديث الدالة handleDeleteGroup للتعامل مع قاعدة البيانات المحلية
const handleDeleteGroup = async (id: number) => {
  try {
    await window.db.deleteGroup(id);
    fetchGroups();
  } catch (error) {
    console.error("Error deleting group:", error);
    setError(error instanceof Error ? error.message : "خطأ أثناء حذف المجموعة");
  }
}; 