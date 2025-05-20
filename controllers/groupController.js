const UserGroup = require("../models/userGroupModel");

exports.createUserGroup = async (req, res) => {
  try {
    console.log("Incoming user on create group:", req.user); // 👈 Add this

    const { name, type, accessCode } = req.body;
    const ownerId = req.user.id;

    if (!ownerId) {
      return res.status(400).json({ error: "Authenticated user not found" });
    }

    const userGroup = new UserGroup({
      name,
      type: type || "custom",
      owner: ownerId,
      primaryContact: ownerId,
      members: [ownerId],
      accessCode: accessCode
    });

    await userGroup.save();
    res.status(201).json(userGroup);
  } catch (err) {
    console.error("Error creating user group:", err);
    res.status(500).json({ error: "Failed to create group" });
  }
};


exports.getMyGroups = async (req, res) => {
  try {
    const userId = req.user.id;

    const groups = await UserGroup.find({
      members: userId,
      isArchived: false, // ✅ Filter for active groups only
    })
      .populate("owner", "name email")
      .populate("primaryContact", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(groups);
  } catch (err) {
    console.error("Error fetching user's groups:", err);
    res.status(500).json({ error: "Failed to fetch groups" });
  }
};

exports.updateGroupByOwner = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id; // or req.user._id depending on middleware
    const {
      name,
      type,
      primaryContact,
      tags,
      notes,
      invitedUsers = [],
    } = req.body;

    const group = await UserGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // 🔍 Add logging to see what's going wrong
    console.log("🔍 Group owner:", group.owner.toString());
    console.log("🔍 Requesting user:", userId.toString());

    if (group.owner.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ error: "Only the group owner can update this group." });
    }

    // ✅ Update allowed fields
    if (name) group.name = name;
    if (type) group.type = type;
    if (primaryContact) group.primaryContact = primaryContact;
    if (tags) group.tags = tags;
    if (notes) group.notes = notes;

    // ✅ Handle invitedUsers
    if (Array.isArray(invitedUsers)) {
      invitedUsers.forEach((invite) => {
        const existing = group.invitedUsers.find(
          (i) => i.userId.toString() === invite.userId
        );

        if (invite.remove) {
          group.invitedUsers = group.invitedUsers.filter(
            (i) => i.userId.toString() !== invite.userId
          );
        } else if (existing) {
          existing.status = invite.status || existing.status;
        } else {
          group.invitedUsers.push({
            userId: invite.userId,
            status: invite.status || "pending",
            invitedAt: new Date(),
          });
        }
      });
    }

    await group.save();
    res.status(200).json(group);
  } catch (err) {
    console.error("❌ Error updating group:", err);
    res.status(500).json({ error: "Failed to update group" });
  }
};

exports.getArchivedGroups = async (req, res) => {
  try {
    const userId = req.user.id;

    const groups = await UserGroup.find({
      members: userId,
      isArchived: true, // ✅ Only archived groups
    })
      .populate("owner", "name email")
      .populate("primaryContact", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(groups);
  } catch (err) {
    console.error("Error fetching archived groups:", err);
    res.status(500).json({ error: "Failed to fetch archived groups" });
  }
};

exports.archiveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await UserGroup.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (group.owner.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ error: "Only the group owner can archive this group" });
    }

    group.isArchived = true;
    await group.save();

    res.status(200).json({ message: "Group archived successfully", group });
  } catch (err) {
    console.error("Error archiving group:", err);
    res.status(500).json({ error: "Failed to archive group" });
  }
};

exports.unarchiveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await UserGroup.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (group.owner.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ error: "Only the group owner can unarchive this group" });
    }

    group.isArchived = false;
    await group.save();

    res.status(200).json({ message: "Group unarchived successfully", group });
  } catch (err) {
    console.error("Error unarchiving group:", err);
    res.status(500).json({ error: "Failed to unarchive group" });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await UserGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (group.owner.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ error: "Only the group owner can delete this group" });
    }

    await group.deleteOne();

    res.status(200).json({ message: "Group permanently deleted" });
  } catch (err) {
    console.error("Error deleting group:", err);
    res.status(500).json({ error: "Failed to delete group" });
  }
};

exports.searchGroups = async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ error: "Name is required for search" });
    }

    const regex = new RegExp(name, "i"); // case-insensitive search
    const results = await UserGroup.find({
      name: regex,
      isArchived: false,
    }).select("name type members.length createdAt"); // restrict sensitive info

    res.status(200).json(results);
  } catch (err) {
    console.error("Error searching groups:", err);
    res.status(500).json({ error: "Failed to search groups" });
  }
};

exports.joinGroupWithAccessCode = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { accessCode } = req.body;
    const userId = req.user.id;

    const group = await UserGroup.findById(groupId).select("+accessCode");
    if (!group) return res.status(404).json({ error: "Group not found" });

    // Prevent duplicate joins
    if (group.members.includes(userId)) {
      return res
        .status(400)
        .json({ error: "You are already a member of this group" });
    }

    // Validate access code
    const isMatch = await group.compareAccessCode(accessCode);
    if (!isMatch) {
      return res.status(403).json({ error: "Invalid access code" });
    }

    // Add user
    group.members.push(userId);
    await group.save();

    res.status(200).json({ message: "Joined group successfully", group });
  } catch (err) {
    console.error("Error joining group:", err);
    res.status(500).json({ error: "Failed to join group" });
  }
};

exports.leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await UserGroup.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const isMember = group.members.includes(userId);
    if (!isMember) {
      return res
        .status(400)
        .json({ error: "You are not a member of this group" });
    }

    // Remove user from members
    group.members = group.members.filter(
      (memberId) => memberId.toString() !== userId.toString()
    );

    // If the user is the owner
    if (group.owner.toString() === userId.toString()) {
      if (group.members.length > 0) {
        // Transfer ownership to the next member
        group.owner = group.members[0];
        group.primaryContact = group.members[0];
      } else {
        // No members left — delete the group
        await group.deleteOne();
        return res
          .status(200)
          .json({ message: "Group deleted (last member left)" });
      }
    }

    await group.save();
    res.status(200).json({ message: "You have left the group", group });
  } catch (err) {
    console.error("Error leaving group:", err);
    res.status(500).json({ error: "Failed to leave group" });
  }
};

exports.transferGroupOwnership = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { newOwnerId } = req.body;
    const userId = req.user.id || req.user._id;

    if (!newOwnerId) {
      return res.status(400).json({ error: "New owner ID is required" });
    }

    const group = await UserGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // 🔍 Log values for debugging
    console.log("🔍 Group owner:", group.owner.toString());
    console.log("🔍 Requesting user:", userId.toString());

    // ✅ Check if current user is the owner
    if (group.owner.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ error: "Only the current owner can transfer ownership" });
    }

    // ✅ Check that new owner is already a member
    const isMember = group.members.some(
      (memberId) => memberId.toString() === newOwnerId
    );

    if (!isMember) {
      return res
        .status(400)
        .json({ error: "New owner must be a current group member" });
    }

    // ✅ Transfer ownership
    group.owner = newOwnerId;
    group.primaryContact = newOwnerId;

    await group.save();
    res.status(200).json({ message: "Group ownership transferred", group });
  } catch (err) {
    console.error("❌ Error transferring group ownership:", err);
    res.status(500).json({ error: "Failed to transfer ownership" });
  }
};