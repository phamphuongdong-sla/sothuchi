/* ==========================================================================
   Sổ Thu Chi Cá Nhân - 3-Tier Category Customization System (js/categories.js)
   Milestone M2 & 3-Tier Hierarchy Implementation
   ========================================================================== */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'stc_categories';
  const ALT_STORAGE_KEY = 'so_thu_chi_categories';
  const GROUPS_STORAGE_KEY = 'stc_category_groups';

  /**
   * 15 Standard Category Groups (Tier 2: Nhóm chính)
   */
  const DEFAULT_GROUPS = [
    { id: 'group_ex_1', name: '1. Ăn uống', type: 'expense', icon: '🍜', color: '#ef4444', is_default: true },
    { id: 'group_ex_2', name: '2. Nhà cửa', type: 'expense', icon: '🏠', color: '#06b6d4', is_default: true },
    { id: 'group_ex_3', name: '3. Đi lại', type: 'expense', icon: '🚗', color: '#f97316', is_default: true },
    { id: 'group_ex_4', name: '4. Sức khỏe', type: 'expense', icon: '🏥', color: '#14b8a6', is_default: true },
    { id: 'group_ex_5', name: '5. Giáo dục', type: 'expense', icon: '📚', color: '#3b82f6', is_default: true },
    { id: 'group_ex_6', name: '6. Con cái', type: 'expense', icon: '👶', color: '#ec4899', is_default: true },
    { id: 'group_ex_7', name: '7. Cá nhân', type: 'expense', icon: '💄', color: '#a855f7', is_default: true },
    { id: 'group_ex_8', name: '8. Gia đình – xã hội', type: 'expense', icon: '💌', color: '#f43f5e', is_default: true },
    { id: 'group_ex_9', name: '9. Giải trí', type: 'expense', icon: '🎬', color: '#8b5cf6', is_default: true },
    { id: 'group_ex_10', name: '10. Mua sắm', type: 'expense', icon: '🛒', color: '#059669', is_default: true },
    { id: 'group_ex_11', name: '11. Công việc', type: 'expense', icon: '💼', color: '#4f46e5', is_default: true },
    { id: 'group_ex_12', name: '12. Thú cưng', type: 'expense', icon: '🐾', color: '#10b981', is_default: true },
    { id: 'group_ex_13', name: '13. Thuế – phí', type: 'expense', icon: '🏛️', color: '#d97706', is_default: true },
    { id: 'group_ex_14', name: '14. Khác', type: 'expense', icon: '✨', color: '#64748b', is_default: true },

    // Income Group
    { id: 'group_in_1', name: 'Thu nhập', type: 'income', icon: '💰', color: '#10b981', is_default: true }
  ];

  /**
   * Default Subcategories (~92 Items across 15 Groups)
   */
  const DEFAULT_CATEGORIES = [
    // Group 1: 1. Ăn uống (Expense)
    { id: 'cat_ex_1_1', name: 'Đi chợ', group: '1. Ăn uống', groupId: 'group_ex_1', type: 'expense', icon: '🛒', color: '#ef4444', is_default: true },
    { id: 'cat_ex_1_2', name: 'Siêu thị', group: '1. Ăn uống', groupId: 'group_ex_1', type: 'expense', icon: '🏬', color: '#ef4444', is_default: true },
    { id: 'cat_ex_1_3', name: 'Ăn ngoài', group: '1. Ăn uống', groupId: 'group_ex_1', type: 'expense', icon: '🍽️', color: '#ef4444', is_default: true },
    { id: 'cat_ex_1_4', name: 'Đặt đồ ăn', group: '1. Ăn uống', groupId: 'group_ex_1', type: 'expense', icon: '🛵', color: '#ef4444', is_default: true },
    { id: 'cat_ex_1_5', name: 'Cà phê/đồ uống', group: '1. Ăn uống', groupId: 'group_ex_1', type: 'expense', icon: '☕', color: '#ef4444', is_default: true },
    { id: 'cat_ex_1_6', name: 'Đồ ăn vặt', group: '1. Ăn uống', groupId: 'group_ex_1', type: 'expense', icon: '🍿', color: '#ef4444', is_default: true },

    // Group 2: 2. Nhà cửa (Expense)
    { id: 'cat_ex_2_1', name: 'Tiền nhà', group: '2. Nhà cửa', groupId: 'group_ex_2', type: 'expense', icon: '🔑', color: '#06b6d4', is_default: true },
    { id: 'cat_ex_2_2', name: 'Điện', group: '2. Nhà cửa', groupId: 'group_ex_2', type: 'expense', icon: '⚡', color: '#06b6d4', is_default: true },
    { id: 'cat_ex_2_3', name: 'Nước', group: '2. Nhà cửa', groupId: 'group_ex_2', type: 'expense', icon: '💧', color: '#06b6d4', is_default: true },
    { id: 'cat_ex_2_4', name: 'Gas', group: '2. Nhà cửa', groupId: 'group_ex_2', type: 'expense', icon: '🔥', color: '#06b6d4', is_default: true },
    { id: 'cat_ex_2_5', name: 'Internet/điện thoại', group: '2. Nhà cửa', groupId: 'group_ex_2', type: 'expense', icon: '🌐', color: '#06b6d4', is_default: true },
    { id: 'cat_ex_2_6', name: 'Đồ gia dụng', group: '2. Nhà cửa', groupId: 'group_ex_2', type: 'expense', icon: '🛋️', color: '#06b6d4', is_default: true },
    { id: 'cat_ex_2_7', name: 'Sửa chữa/bảo trì', group: '2. Nhà cửa', groupId: 'group_ex_2', type: 'expense', icon: '🛠️', color: '#06b6d4', is_default: true },
    { id: 'cat_ex_2_8', name: 'Vệ sinh', group: '2. Nhà cửa', groupId: 'group_ex_2', type: 'expense', icon: '🧹', color: '#06b6d4', is_default: true },

    // Group 3: 3. Đi lại (Expense)
    { id: 'cat_ex_3_1', name: 'Xăng/dầu', group: '3. Đi lại', groupId: 'group_ex_3', type: 'expense', icon: '⛽', color: '#f97316', is_default: true },
    { id: 'cat_ex_3_2', name: 'Sạc xe', group: '3. Đi lại', groupId: 'group_ex_3', type: 'expense', icon: '🔌', color: '#f97316', is_default: true },
    { id: 'cat_ex_3_3', name: 'Taxi/Grab', group: '3. Đi lại', groupId: 'group_ex_3', type: 'expense', icon: '🚖', color: '#f97316', is_default: true },
    { id: 'cat_ex_3_4', name: 'Xe buýt', group: '3. Đi lại', groupId: 'group_ex_3', type: 'expense', icon: '🚌', color: '#f97316', is_default: true },
    { id: 'cat_ex_3_5', name: 'Gửi xe', group: '3. Đi lại', groupId: 'group_ex_3', type: 'expense', icon: '🅿️', color: '#f97316', is_default: true },
    { id: 'cat_ex_3_6', name: 'Cầu đường', group: '3. Đi lại', groupId: 'group_ex_3', type: 'expense', icon: '🛣️', color: '#f97316', is_default: true },
    { id: 'cat_ex_3_7', name: 'Bảo dưỡng/sửa xe', group: '3. Đi lại', groupId: 'group_ex_3', type: 'expense', icon: '🔧', color: '#f97316', is_default: true },
    { id: 'cat_ex_3_8', name: 'Mua phương tiện', group: '3. Đi lại', groupId: 'group_ex_3', type: 'expense', icon: '🚘', color: '#f97316', is_default: true },

    // Group 4: 4. Sức khỏe (Expense)
    { id: 'cat_ex_4_1', name: 'Khám bệnh', group: '4. Sức khỏe', groupId: 'group_ex_4', type: 'expense', icon: '🩺', color: '#14b8a6', is_default: true },
    { id: 'cat_ex_4_2', name: 'Thuốc', group: '4. Sức khỏe', groupId: 'group_ex_4', type: 'expense', icon: '💊', color: '#14b8a6', is_default: true },
    { id: 'cat_ex_4_3', name: 'Xét nghiệm/điều trị', group: '4. Sức khỏe', groupId: 'group_ex_4', type: 'expense', icon: '🔬', color: '#14b8a6', is_default: true },
    { id: 'cat_ex_4_4', name: 'Nha khoa', group: '4. Sức khỏe', groupId: 'group_ex_4', type: 'expense', icon: '🦷', color: '#14b8a6', is_default: true },
    { id: 'cat_ex_4_5', name: 'Bảo hiểm', group: '4. Sức khỏe', groupId: 'group_ex_4', type: 'expense', icon: '🛡️', color: '#14b8a6', is_default: true },
    { id: 'cat_ex_4_6', name: 'Chăm sóc sức khỏe khác', group: '4. Sức khỏe', groupId: 'group_ex_4', type: 'expense', icon: '🌿', color: '#14b8a6', is_default: true },

    // Group 5: 5. Giáo dục (Expense)
    { id: 'cat_ex_5_1', name: 'Học phí', group: '5. Giáo dục', groupId: 'group_ex_5', type: 'expense', icon: '🎓', color: '#3b82f6', is_default: true },
    { id: 'cat_ex_5_2', name: 'Học thêm', group: '5. Giáo dục', groupId: 'group_ex_5', type: 'expense', icon: '📖', color: '#3b82f6', is_default: true },
    { id: 'cat_ex_5_3', name: 'Sách', group: '5. Giáo dục', groupId: 'group_ex_5', type: 'expense', icon: '📘', color: '#3b82f6', is_default: true },
    { id: 'cat_ex_5_4', name: 'Đồ dùng học tập', group: '5. Giáo dục', groupId: 'group_ex_5', type: 'expense', icon: '✏️', color: '#3b82f6', is_default: true },
    { id: 'cat_ex_5_5', name: 'Khóa học', group: '5. Giáo dục', groupId: 'group_ex_5', type: 'expense', icon: '💻', color: '#3b82f6', is_default: true },
    { id: 'cat_ex_5_6', name: 'Các khoản trường/lớp', group: '5. Giáo dục', groupId: 'group_ex_5', type: 'expense', icon: '🏫', color: '#3b82f6', is_default: true },

    // Group 6: 6. Con cái (Expense)
    { id: 'cat_ex_6_1', name: 'Sữa/bỉm', group: '6. Con cái', groupId: 'group_ex_6', type: 'expense', icon: '🍼', color: '#ec4899', is_default: true },
    { id: 'cat_ex_6_2', name: 'Quần áo con', group: '6. Con cái', groupId: 'group_ex_6', type: 'expense', icon: '👕', color: '#ec4899', is_default: true },
    { id: 'cat_ex_6_3', name: 'Đồ chơi', group: '6. Con cái', groupId: 'group_ex_6', type: 'expense', icon: '🧸', color: '#ec4899', is_default: true },
    { id: 'cat_ex_6_4', name: 'Đồ dùng con', group: '6. Con cái', groupId: 'group_ex_6', type: 'expense', icon: '🎒', color: '#ec4899', is_default: true },
    { id: 'cat_ex_6_5', name: 'Hoạt động', group: '6. Con cái', groupId: 'group_ex_6', type: 'expense', icon: '🎨', color: '#ec4899', is_default: true },
    { id: 'cat_ex_6_6', name: 'Chi phí khác (Con)', group: '6. Con cái', groupId: 'group_ex_6', type: 'expense', icon: '✨', color: '#ec4899', is_default: true },

    // Group 7: 7. Cá nhân (Expense)
    { id: 'cat_ex_7_1', name: 'Quần áo', group: '7. Cá nhân', groupId: 'group_ex_7', type: 'expense', icon: '👔', color: '#a855f7', is_default: true },
    { id: 'cat_ex_7_2', name: 'Giày dép', group: '7. Cá nhân', groupId: 'group_ex_7', type: 'expense', icon: '👟', color: '#a855f7', is_default: true },
    { id: 'cat_ex_7_3', name: 'Mỹ phẩm', group: '7. Cá nhân', groupId: 'group_ex_7', type: 'expense', icon: '💄', color: '#a855f7', is_default: true },
    { id: 'cat_ex_7_4', name: 'Cắt tóc', group: '7. Cá nhân', groupId: 'group_ex_7', type: 'expense', icon: '✂️', color: '#a855f7', is_default: true },
    { id: 'cat_ex_7_5', name: 'Chăm sóc cá nhân', group: '7. Cá nhân', groupId: 'group_ex_7', type: 'expense', icon: '🧴', color: '#a855f7', is_default: true },
    { id: 'cat_ex_7_6', name: 'Đồ dùng cá nhân', group: '7. Cá nhân', groupId: 'group_ex_7', type: 'expense', icon: '🪮', color: '#a855f7', is_default: true },

    // Group 8: 8. Gia đình – xã hội (Expense)
    { id: 'cat_ex_8_1', name: 'Biếu bố mẹ', group: '8. Gia đình – xã hội', groupId: 'group_ex_8', type: 'expense', icon: '👵', color: '#f43f5e', is_default: true },
    { id: 'cat_ex_8_2', name: 'Hỗ trợ người thân', group: '8. Gia đình – xã hội', groupId: 'group_ex_8', type: 'expense', icon: '🤝', color: '#f43f5e', is_default: true },
    { id: 'cat_ex_8_3', name: 'Cưới hỏi', group: '8. Gia đình – xã hội', groupId: 'group_ex_8', type: 'expense', icon: '💒', color: '#f43f5e', is_default: true },
    { id: 'cat_ex_8_4', name: 'Hiếu hỷ', group: '8. Gia đình – xã hội', groupId: 'group_ex_8', type: 'expense', icon: '💐', color: '#f43f5e', is_default: true },
    { id: 'cat_ex_8_5', name: 'Quà tặng', group: '8. Gia đình – xã hội', groupId: 'group_ex_8', type: 'expense', icon: '🎁', color: '#f43f5e', is_default: true },
    { id: 'cat_ex_8_6', name: 'Thăm hỏi', group: '8. Gia đình – xã hội', groupId: 'group_ex_8', type: 'expense', icon: '🩺', color: '#f43f5e', is_default: true },
    { id: 'cat_ex_8_7', name: 'Từ thiện', group: '8. Gia đình – xã hội', groupId: 'group_ex_8', type: 'expense', icon: '❤️', color: '#f43f5e', is_default: true },

    // Group 9: 9. Giải trí (Expense)
    { id: 'cat_ex_9_1', name: 'Du lịch', group: '9. Giải trí', groupId: 'group_ex_9', type: 'expense', icon: '✈️', color: '#8b5cf6', is_default: true },
    { id: 'cat_ex_9_2', name: 'Nhà hàng', group: '9. Giải trí', groupId: 'group_ex_9', type: 'expense', icon: '🍷', color: '#8b5cf6', is_default: true },
    { id: 'cat_ex_9_3', name: 'Phim/Karaoke', group: '9. Giải trí', groupId: 'group_ex_9', type: 'expense', icon: '🎤', color: '#8b5cf6', is_default: true },
    { id: 'cat_ex_9_4', name: 'Thể thao/Gym', group: '9. Giải trí', groupId: 'group_ex_9', type: 'expense', icon: '🏋️', color: '#8b5cf6', is_default: true },
    { id: 'cat_ex_9_5', name: 'Sở thích', group: '9. Giải trí', groupId: 'group_ex_9', type: 'expense', icon: '🎨', color: '#8b5cf6', is_default: true },
    { id: 'cat_ex_9_6', name: 'Dịch vụ số', group: '9. Giải trí', groupId: 'group_ex_9', type: 'expense', icon: '📺', color: '#8b5cf6', is_default: true },

    // Group 10: 10. Mua sắm (Expense)
    { id: 'cat_ex_10_1', name: 'Điện thoại', group: '10. Mua sắm', groupId: 'group_ex_10', type: 'expense', icon: '📱', color: '#059669', is_default: true },
    { id: 'cat_ex_10_2', name: 'Máy tính', group: '10. Mua sắm', groupId: 'group_ex_10', type: 'expense', icon: '💻', color: '#059669', is_default: true },
    { id: 'cat_ex_10_3', name: 'Điện máy', group: '10. Mua sắm', groupId: 'group_ex_10', type: 'expense', icon: '📺', color: '#059669', is_default: true },
    { id: 'cat_ex_10_4', name: 'Nội thất', group: '10. Mua sắm', groupId: 'group_ex_10', type: 'expense', icon: '🛏️', color: '#059669', is_default: true },
    { id: 'cat_ex_10_5', name: 'Đồ dùng', group: '10. Mua sắm', groupId: 'group_ex_10', type: 'expense', icon: '📦', color: '#059669', is_default: true },
    { id: 'cat_ex_10_6', name: 'Mua sắm online', group: '10. Mua sắm', groupId: 'group_ex_10', type: 'expense', icon: '🛍️', color: '#059669', is_default: true },
    { id: 'cat_ex_10_7', name: 'Khác (Mua sắm)', group: '10. Mua sắm', groupId: 'group_ex_10', type: 'expense', icon: '📦', color: '#059669', is_default: true },

    // Group 11: 11. Công việc (Expense)
    { id: 'cat_ex_11_1', name: 'Ăn uống công việc', group: '11. Công việc', groupId: 'group_ex_11', type: 'expense', icon: '🍱', color: '#4f46e5', is_default: true },
    { id: 'cat_ex_11_2', name: 'Đi lại công việc', group: '11. Công việc', groupId: 'group_ex_11', type: 'expense', icon: '🚕', color: '#4f46e5', is_default: true },
    { id: 'cat_ex_11_3', name: 'Tiếp khách', group: '11. Công việc', groupId: 'group_ex_11', type: 'expense', icon: '🤝', color: '#4f46e5', is_default: true },
    { id: 'cat_ex_11_4', name: 'Công tác', group: '11. Công việc', groupId: 'group_ex_11', type: 'expense', icon: '🧳', color: '#4f46e5', is_default: true },
    { id: 'cat_ex_11_5', name: 'Thiết bị làm việc', group: '11. Công việc', groupId: 'group_ex_11', type: 'expense', icon: '🖥️', color: '#4f46e5', is_default: true },
    { id: 'cat_ex_11_6', name: 'Chi phí kinh doanh', group: '11. Công việc', groupId: 'group_ex_11', type: 'expense', icon: '📊', color: '#4f46e5', is_default: true },

    // Group 12: 12. Thú cưng (Expense)
    { id: 'cat_ex_12_1', name: 'Thức ăn thú cưng', group: '12. Thú cưng', groupId: 'group_ex_12', type: 'expense', icon: '🥩', color: '#10b981', is_default: true },
    { id: 'cat_ex_12_2', name: 'Y tế thú cưng', group: '12. Thú cưng', groupId: 'group_ex_12', type: 'expense', icon: '🩺', color: '#10b981', is_default: true },
    { id: 'cat_ex_12_3', name: 'Đồ dùng thú cưng', group: '12. Thú cưng', groupId: 'group_ex_12', type: 'expense', icon: '🦮', color: '#10b981', is_default: true },
    { id: 'cat_ex_12_4', name: 'Chăm sóc thú cưng', group: '12. Thú cưng', groupId: 'group_ex_12', type: 'expense', icon: '✂️', color: '#10b981', is_default: true },

    // Group 13: 13. Thuế – phí (Expense)
    { id: 'cat_ex_13_1', name: 'Thuế', group: '13. Thuế – phí', groupId: 'group_ex_13', type: 'expense', icon: '🧾', color: '#d97706', is_default: true },
    { id: 'cat_ex_13_2', name: 'Phí ngân hàng', group: '13. Thuế – phí', groupId: 'group_ex_13', type: 'expense', icon: '🏦', color: '#d97706', is_default: true },
    { id: 'cat_ex_13_3', name: 'Phí hành chính', group: '13. Thuế – phí', groupId: 'group_ex_13', type: 'expense', icon: '📋', color: '#d97706', is_default: true },
    { id: 'cat_ex_13_4', name: 'Phạt', group: '13. Thuế – phí', groupId: 'group_ex_13', type: 'expense', icon: '⚠️', color: '#d97706', is_default: true },
    { id: 'cat_ex_13_5', name: 'Các khoản phí khác', group: '13. Thuế – phí', groupId: 'group_ex_13', type: 'expense', icon: '💵', color: '#d97706', is_default: true },

    // Group 14: 14. Khác (Expense)
    { id: 'cat_ex_14_1', name: 'Chi khẩn cấp', group: '14. Khác', groupId: 'group_ex_14', type: 'expense', icon: '🚨', color: '#64748b', is_default: true },
    { id: 'cat_ex_14_2', name: 'Chi bất thường', group: '14. Khác', groupId: 'group_ex_14', type: 'expense', icon: '⚡', color: '#64748b', is_default: true },
    { id: 'cat_ex_14_3', name: 'Không phân loại', group: '14. Khác', groupId: 'group_ex_14', type: 'expense', icon: '📁', color: '#64748b', is_default: true },

    // Group 15: Thu nhập (Income)
    { id: 'cat_in_1_1', name: 'Lương', group: 'Thu nhập', groupId: 'group_in_1', type: 'income', icon: '💵', color: '#10b981', is_default: true },
    { id: 'cat_in_1_2', name: 'Thưởng (Thưởng Tết, KPI)', group: 'Thu nhập', groupId: 'group_in_1', type: 'income', icon: '🎁', color: '#3b82f6', is_default: true },
    { id: 'cat_in_1_3', name: 'Bán hàng & Kinh doanh', group: 'Thu nhập', groupId: 'group_in_1', type: 'income', icon: '🛍️', color: '#8b5cf6', is_default: true },
    { id: 'cat_in_1_4', name: 'Thu nhập phụ / Làm thêm', group: 'Thu nhập', groupId: 'group_in_1', type: 'income', icon: '💼', color: '#06b6d4', is_default: true },
    { id: 'cat_in_1_5', name: 'Đầu tư & Lãi tiết kiệm', group: 'Thu nhập', groupId: 'group_in_1', type: 'income', icon: '📈', color: '#f59e0b', is_default: true },
    { id: 'cat_in_1_6', name: 'Lì xì / Thăm biếu', group: 'Thu nhập', groupId: 'group_in_1', type: 'income', icon: '🧧', color: '#dc2626', is_default: true },
    { id: 'cat_in_1_7', name: 'Thu hồi nợ / Cho vay', group: 'Thu nhập', groupId: 'group_in_1', type: 'income', icon: '🤝', color: '#10b981', is_default: true },
    { id: 'cat_in_1_8', name: 'Khác', group: 'Thu nhập', groupId: 'group_in_1', type: 'income', icon: '✨', color: '#64748b', is_default: true }
  ];

  /**
   * Helper mapping from old category names to 3-tier group names
   */
  function mapOldCategoryToGroup(catName, type) {
    if (type === 'income') return 'Thu nhập';
    if (!catName) return '14. Khác';

    const lower = String(catName).toLowerCase();
    if (lower.includes('ăn uống')) return '1. Ăn uống';
    if (lower.includes('nhà ở') || lower.includes('nhà cửa')) return '2. Nhà cửa';
    if (lower.includes('đi lại') || lower.includes('phương tiện')) return '3. Đi lại';
    if (lower.includes('sức khỏe') || lower.includes('y tế')) return '4. Sức khỏe';
    if (lower.includes('giáo dục') || lower.includes('học tập')) return '5. Giáo dục';
    if (lower.includes('con cái')) return '6. Con cái';
    if (lower.includes('cá nhân') || lower.includes('quần áo')) return '7. Cá nhân';
    if (lower.includes('gia đình') || lower.includes('hiếu hỷ') || lower.includes('biếu')) return '8. Gia đình – xã hội';
    if (lower.includes('giải trí') || lower.includes('hưởng thụ')) return '9. Giải trí';
    if (lower.includes('mua sắm') || lower.includes('đồ gia dụng')) return '10. Mua sắm';
    if (lower.includes('công việc') || lower.includes('kinh doanh')) return '11. Công việc';
    if (lower.includes('thú cưng')) return '12. Thú cưng';
    if (lower.includes('thuế') || lower.includes('nghĩa vụ')) return '13. Thuế – phí';
    return '14. Khác';
  }

  let _groupsCache = null;

  /**
   * Normalize Group object properties
   */
  function normalizeGroup(g) {
    if (!g) return null;
    const typeVal = g.type === 'income' ? 'income' : 'expense';
    const isDefault = typeof g.isDefault === 'boolean'
      ? g.isDefault
      : (typeof g.is_default === 'boolean' ? g.is_default : false);

    return {
      id: String(g.id || ('group_' + (typeVal === 'income' ? 'in_' : 'ex_') + Date.now())),
      name: String(g.name || '').trim(),
      type: typeVal,
      icon: g.icon || (typeVal === 'income' ? '💰' : '📁'),
      color: g.color || (typeVal === 'income' ? '#10b981' : '#ef4444'),
      isDefault: isDefault,
      is_default: isDefault
    };
  }

  /**
   * Normalize Category object properties for 3-tier hierarchy
   */
  function normalizeCategory(cat, givenGroups) {
    if (!cat) return null;
    const isHidden = typeof cat.isHidden === 'boolean'
      ? cat.isHidden
      : (typeof cat.is_hidden === 'boolean' ? cat.is_hidden : false);
    const isDefault = typeof cat.isDefault === 'boolean'
      ? cat.isDefault
      : (typeof cat.is_default === 'boolean' ? cat.is_default : false);

    const typeVal = cat.type === 'income' ? 'income' : 'expense';
    const groupName = cat.group || cat.groupName || mapOldCategoryToGroup(cat.name, typeVal);

    // Find group details using given groups or cached groups
    const groups = givenGroups || readGroupsFromStorage();
    const matchedGroup = groups ? groups.find(g => g.name === groupName || g.id === cat.groupId) : null;
    const groupIdVal = matchedGroup ? matchedGroup.id : (cat.groupId || 'group_ex_14');
    const groupColor = matchedGroup ? matchedGroup.color : (cat.color || (typeVal === 'income' ? '#10b981' : '#ef4444'));

    return {
      id: String(cat.id),
      name: String(cat.name || '').trim(),
      group: matchedGroup ? matchedGroup.name : groupName,
      groupId: groupIdVal,
      type: typeVal,
      icon: cat.icon || (typeVal === 'income' ? '💵' : '📁'),
      color: cat.color || groupColor,
      isHidden: isHidden,
      is_hidden: isHidden,
      isDefault: isDefault,
      is_default: isDefault
    };
  }

  function readGroupsFromStorage() {
    if (_groupsCache && Array.isArray(_groupsCache) && _groupsCache.length > 0) {
      return _groupsCache;
    }
    try {
      if (typeof localStorage === 'undefined') {
        _groupsCache = DEFAULT_GROUPS.map(normalizeGroup);
        return _groupsCache;
      }
      const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (!raw) {
        _groupsCache = DEFAULT_GROUPS.map(normalizeGroup);
        saveGroupsToStorage(_groupsCache);
        return _groupsCache;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        _groupsCache = DEFAULT_GROUPS.map(normalizeGroup);
        saveGroupsToStorage(_groupsCache);
        return _groupsCache;
      }
      const normalizedList = parsed.map(normalizeGroup).filter(Boolean);

      // Auto-merge missing default groups
      const existingIds = new Set(normalizedList.map(g => g.id));
      let hasChanges = false;
      DEFAULT_GROUPS.forEach(defG => {
        if (!existingIds.has(defG.id) && !normalizedList.some(g => g.name.toLowerCase() === defG.name.toLowerCase())) {
          normalizedList.push(normalizeGroup(defG));
          hasChanges = true;
        }
      });

      _groupsCache = normalizedList;
      if (hasChanges) {
        saveGroupsToStorage(_groupsCache);
      }
      return _groupsCache;
    } catch (e) {
      _groupsCache = DEFAULT_GROUPS.map(normalizeGroup);
      return _groupsCache;
    }
  }

  function saveGroupsToStorage(groups) {
    const normalized = (groups || []).map(normalizeGroup).filter(Boolean);
    _groupsCache = normalized;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(normalized));
      }
    } catch (e) {}
    return normalized;
  }

  function readFromStorage() {
    const groups = readGroupsFromStorage();
    try {
      if (typeof localStorage === 'undefined') {
        return DEFAULT_CATEGORIES.map(c => normalizeCategory(c, groups));
      }

      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(ALT_STORAGE_KEY);
      if (!raw) {
        saveToStorage(DEFAULT_CATEGORIES);
        return DEFAULT_CATEGORIES.map(c => normalizeCategory(c, groups));
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        saveToStorage(DEFAULT_CATEGORIES);
        return DEFAULT_CATEGORIES.map(c => normalizeCategory(c, groups));
      }

      const normalizedList = parsed.map(c => normalizeCategory(c, groups)).filter(Boolean);

      // Auto-merge missing default categories & update default names
      const existingIds = new Set(normalizedList.map(c => c.id));
      const existingNames = new Set(normalizedList.map(c => c.name.toLowerCase()));
      let hasChanges = false;

      DEFAULT_CATEGORIES.forEach(defCat => {
        const normDef = normalizeCategory(defCat, groups);
        const matchById = normalizedList.find(c => c.id === normDef.id);
        if (matchById) {
          if (matchById.isDefault && matchById.name !== normDef.name) {
            matchById.name = normDef.name;
            matchById.icon = normDef.icon;
            matchById.color = normDef.color;
            matchById.group = normDef.group;
            matchById.groupId = normDef.groupId;
            hasChanges = true;
          }
        } else if (!existingNames.has(normDef.name.toLowerCase())) {
          normalizedList.push(normDef);
          hasChanges = true;
        }
      });

      if (hasChanges) {
        saveToStorage(normalizedList);
      }

      return normalizedList;
    } catch (e) {
      return DEFAULT_CATEGORIES.map(c => normalizeCategory(c, groups));
    }
  }

  function saveToStorage(categories) {
    const groups = readGroupsFromStorage();
    const normalized = (categories || []).map(c => normalizeCategory(c, groups)).filter(Boolean);
    try {
      if (typeof localStorage !== 'undefined') {
        const json = JSON.stringify(normalized);
        localStorage.setItem(STORAGE_KEY, json);
        localStorage.setItem(ALT_STORAGE_KEY, json);
      }
    } catch (e) {}

    // Dispatch Custom DOM Event for reactive updates
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('categorieschanged', {
          detail: { categories: normalized }
        }));
      } catch (e) {}
    }

    return normalized;
  }

  const CategoryModule = {
    init() {
      readGroupsFromStorage();
      return readFromStorage();
    },

    getDefaultCategories() {
      return DEFAULT_CATEGORIES.map(normalizeCategory);
    },

    getGroups(type) {
      const groups = readGroupsFromStorage();
      if (!type || type === 'all') return groups;
      return groups.filter(g => g.type === type);
    },

    addGroup(data) {
      if (!data || typeof data !== 'object') {
        throw new Error('Dữ liệu nhóm hạng mục không hợp lệ');
      }
      const name = String(data.name || '').trim();
      if (!name) {
        throw new Error('Tên nhóm không được để trống');
      }
      const targetType = data.type === 'income' ? 'income' : 'expense';
      const groups = readGroupsFromStorage();
      if (groups.some(g => g.type === targetType && g.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('Tên nhóm đã tồn tại');
      }
      const newGroup = normalizeGroup({
        id: data.id || ('group_custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
        name: name,
        type: targetType,
        icon: data.icon || (targetType === 'income' ? '💰' : '📁'),
        color: data.color || (targetType === 'income' ? '#10b981' : '#ef4444'),
        isDefault: false
      });
      groups.push(newGroup);
      saveGroupsToStorage(groups);
      return newGroup;
    },

    mergeRemoteCategories(remoteCats) {
      if (!Array.isArray(remoteCats) || remoteCats.length === 0) return;
      const localCats = readFromStorage();
      const catMap = new Map(localCats.map(c => [c.id || c.name, c]));

      remoteCats.forEach(rc => {
        const norm = normalizeCategory(rc);
        if (norm) {
          catMap.set(norm.id || norm.name, norm);
        }
      });

      const merged = Array.from(catMap.values());
      saveToStorage(merged);
    },

    getByGroup(groupNameOrId) {
      const cats = readFromStorage();
      if (!groupNameOrId) return cats;
      return cats.filter(c => c.group === groupNameOrId || c.groupId === groupNameOrId);
    },

    getAll(type) {
      const cats = readFromStorage();
      if (!type || type === 'all') return cats;
      return cats.filter(c => c.type === type);
    },

    getCategories(includeHidden) {
      const cats = readFromStorage();
      if (includeHidden === false) {
        return cats.filter(c => !c.isHidden && !c.is_hidden);
      }
      return cats;
    },

    getActive(type) {
      const active = readFromStorage().filter(c => !c.isHidden && !c.is_hidden);
      if (!type || type === 'all') return active;
      return active.filter(c => c.type === type);
    },

    addCategory(data) {
      if (!data || typeof data !== 'object') {
        throw new Error('Dữ liệu hạng mục không hợp lệ');
      }

      const trimmedName = String(data.name || '').trim();
      if (!trimmedName) {
        throw new Error('Tên hạng mục không được để trống');
      }

      const targetType = data.type === 'income' ? 'income' : 'expense';
      const groupName = data.group || (targetType === 'income' ? 'Thu nhập' : '14. Khác');
      const cats = readFromStorage();

      // Duplicate check (case-insensitive per type)
      const duplicate = cats.find(c => c.type === targetType && c.name.toLowerCase() === trimmedName.toLowerCase());
      if (duplicate) {
        return duplicate;
      }

      const newCategory = normalizeCategory({
        id: data.id || ('cat_custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
        name: trimmedName,
        group: groupName,
        groupId: data.groupId,
        type: targetType,
        icon: data.icon || (targetType === 'income' ? '💵' : '📁'),
        color: data.color || (targetType === 'income' ? '#10b981' : '#ef4444'),
        isHidden: false,
        isDefault: false
      });

      cats.push(newCategory);
      saveToStorage(cats);
      return newCategory;
    },

    updateCategory(id, updates) {
      if (!id) {
        throw new Error('Không tìm thấy hạng mục');
      }

      const cats = readFromStorage();
      const idx = cats.findIndex(c => c.id === id);
      if (idx === -1) {
        throw new Error('Không tìm thấy hạng mục');
      }

      const current = cats[idx];

      let newName = current.name;
      let newIcon = current.icon;
      let newColor = current.color;
      let newGroup = current.group;

      if (typeof updates === 'string') {
        newName = updates.trim();
      } else if (updates && typeof updates === 'object') {
        if (updates.name !== undefined) newName = String(updates.name).trim();
        if (updates.icon !== undefined) newIcon = String(updates.icon);
        if (updates.color !== undefined) newColor = String(updates.color);
        if (updates.group !== undefined) newGroup = String(updates.group).trim();
      }

      if (!newName) {
        throw new Error('Tên hạng mục không được để trống');
      }

      if (newName.toLowerCase() !== current.name.toLowerCase()) {
        const duplicate = cats.find(c => c.id !== id && c.type === current.type && c.name.toLowerCase() === newName.toLowerCase());
        if (duplicate) {
          throw new Error('Tên hạng mục đã tồn tại');
        }
      }

      cats[idx] = normalizeCategory({
        ...current,
        name: newName,
        icon: newIcon,
        color: newColor,
        group: newGroup
      });

      saveToStorage(cats);
      return cats[idx];
    },

    editCategory(id, newName) {
      return this.updateCategory(id, newName);
    },

    toggleHideCategory(id) {
      if (!id) {
        throw new Error('Không tìm thấy hạng mục');
      }

      const cats = readFromStorage();
      const target = cats.find(c => c.id === id);
      if (!target) {
        throw new Error('Không tìm thấy hạng mục');
      }

      // Check minimum active category constraint (must keep at least 1 active for type)
      if (!target.isHidden && !target.is_hidden) {
        const activeSameType = cats.filter(c => c.type === target.type && !c.isHidden && !c.is_hidden);
        if (activeSameType.length <= 1) {
          throw new Error('Phải giữ ít nhất 1 hạng mục hoạt động');
        }
      }

      target.isHidden = !target.isHidden;
      target.is_hidden = target.isHidden;

      saveToStorage(cats);
      return target.isHidden;
    },

    hideCategory(id) {
      const cats = readFromStorage();
      const target = cats.find(c => c.id === id);
      if (!target) return false;
      if (target.isHidden || target.is_hidden) return true;
      return this.toggleHideCategory(id);
    },

    showCategory(id) {
      const cats = readFromStorage();
      const target = cats.find(c => c.id === id);
      if (!target) return false;
      if (!target.isHidden && !target.is_hidden) return true;
      return this.toggleHideCategory(id);
    },

    resetToDefault() {
      _groupsCache = null;
      saveGroupsToStorage(DEFAULT_GROUPS);
      return saveToStorage(DEFAULT_CATEGORIES);
    },

    saveCategories(cats) {
      return saveToStorage(cats);
    },

    saveToStorage(cats) {
      return saveToStorage(cats);
    }
  };

  // Ensure default categories exist in storage on script load
  try {
    CategoryModule.init();
  } catch (e) {}

  // Export to global scope with all standard class/singleton name aliases
  global.Categories = CategoryModule;
  global.CategoryManager = CategoryModule;
  global.categories = CategoryModule;
  global.categoryManager = CategoryModule;

  if (typeof window !== 'undefined') {
    window.Categories = CategoryModule;
    window.CategoryManager = CategoryModule;
    window.categories = CategoryModule;
    window.categoryManager = CategoryModule;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.Categories = CategoryModule;
    globalThis.CategoryManager = CategoryModule;
    globalThis.categories = CategoryModule;
    globalThis.categoryManager = CategoryModule;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CategoryModule;
  }
})(typeof window !== 'undefined' ? window : this);
