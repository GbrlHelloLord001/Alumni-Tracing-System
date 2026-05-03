
import { supabase } from '../lib/supabaseClient';
import { AlumniUser, FriendRequest, Friend, Conversation, Message, Forum, ForumPost, ForumComment, Group, GroupMessage } from '../types';

// --- BRIDGE: UNIFIED IDENTITY ---

export const getOrCreateAlumniUser = async (sourceId: string, sourceTable: 'students' | 'alumni'): Promise<AlumniUser> => {
  // 1. Fetch Source Data first to ensure we have the latest name info
  const { data: sourceData } = await supabase
      .from(sourceTable)
      .select('first_name, middle_name, last_name')
      .eq('id', sourceId)
      .single();

  const fName = sourceData?.first_name || '';
  const mName = sourceData?.middle_name || '';
  const lName = sourceData?.last_name || '';
  const dName = `${fName} ${lName}`.trim();

  // 2. Check if exists
  const { data: existing } = await supabase
    .from('alumni_users')
    .select('*')
    .eq('source_id', sourceId)
    .eq('source_table', sourceTable)
    .single();

  if (existing) {
    // Self-healing: if display_name is missing or updated, sync it
    if ((!existing.display_name && dName) || (dName && existing.display_name !== dName)) {
        await supabase.from('alumni_users').update({
            first_name: fName,
            middle_name: mName,
            last_name: lName,
            display_name: dName
        }).eq('id', existing.id);
        
        existing.display_name = dName;
        existing.first_name = fName;
        existing.last_name = lName;
    }
    return existing as AlumniUser;
  }

  // 3. If not, create with names
  const payload = { 
      source_id: sourceId, 
      source_table: sourceTable,
      first_name: fName,
      middle_name: mName,
      last_name: lName,
      display_name: dName
  };

  const { data: newUser, error } = await supabase
    .from('alumni_users')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return newUser as AlumniUser;
};

export const hydrateAlumniUsers = async (alumniUsers: AlumniUser[]): Promise<AlumniUser[]> => {
  if (!alumniUsers || alumniUsers.length === 0) return [];

  // Efficiently fetch details for a list of unified users
  const studentIds = alumniUsers.filter(u => u.source_table === 'students').map(u => u.source_id);
  const alumniIds = alumniUsers.filter(u => u.source_table === 'alumni').map(u => u.source_id);

  let students: any[] = [];
  let alumni: any[] = [];

  if (studentIds.length > 0) {
    const res = await supabase.from('students').select('id, first_name, last_name, program, year_level').in('id', studentIds);
    if (res.data) students = res.data;
  }
  if (alumniIds.length > 0) {
    const res = await supabase.from('alumni').select('id, first_name, last_name, program, year_level').in('id', alumniIds);
    if (res.data) alumni = res.data;
  }

  return alumniUsers.map(user => {
    const details = user.source_table === 'students' 
      ? students.find(s => s.id === user.source_id)
      : alumni.find(a => a.id === user.source_id);
    
    if (details) {
      return {
        ...user,
        full_name: user.display_name || `${details.first_name} ${details.last_name}`,
        avatar_initials: user.first_name ? `${user.first_name[0]}${user.last_name?.[0] || ''}` : `${details.first_name[0]}${details.last_name[0]}`,
        program: details.program,
        batch: details.year_level
      };
    }
    // Fallback if source record missing but we have cached names
    if (user.display_name) {
        return {
            ...user,
            full_name: user.display_name,
            avatar_initials: user.first_name ? `${user.first_name[0]}${user.last_name?.[0] || ''}` : 'U',
            program: 'Alumni',
            batch: 'N/A'
        };
    }
    return user;
  });
};

// --- DIRECTORY & FRIENDS ---

export const searchConnectableUsers = async (searchTerm: string, currentUnifiedId: string): Promise<{ user: AlumniUser, status: string }[]> => {
  if (!searchTerm.trim()) return [];

  // 1. Direct optimized search on alumni_users table using the new index/columns
  // We search for matches in display_name, first_name, or last_name
  const { data: searchResults, error } = await supabase
    .from('alumni_users')
    .select('*')
    .or(`display_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%`)
    .neq('id', currentUnifiedId) // Exclude self
    .limit(50);

  if (error) {
      console.error("Search error:", error);
      return [];
  }

  if (!searchResults || searchResults.length === 0) return [];

  // 2. Hydrate (Fetch Program/Batch from source tables)
  const hydrated = await hydrateAlumniUsers(searchResults as AlumniUser[]);

  // 3. Check Friendship Status efficiently
  // Fetch all friend/request records involving current user at once
  const [{ data: friends }, { data: sentRequests }, { data: receivedRequests }] = await Promise.all([
      supabase.from('friends').select('user_id, friend_id').or(`user_id.eq.${currentUnifiedId},friend_id.eq.${currentUnifiedId}`),
      supabase.from('friend_requests').select('receiver_id, status').eq('sender_id', currentUnifiedId),
      supabase.from('friend_requests').select('sender_id, status').eq('receiver_id', currentUnifiedId)
  ]);

  const friendSet = new Set<string>();
  friends?.forEach(f => {
      friendSet.add(f.user_id === currentUnifiedId ? f.friend_id : f.user_id);
  });

  const sentMap = new Map<string, string>();
  sentRequests?.forEach(r => sentMap.set(r.receiver_id, r.status));

  const receivedMap = new Map<string, string>();
  receivedRequests?.forEach(r => receivedMap.set(r.sender_id, 'Received'));

  return hydrated.map(target => {
      let status = 'None';
      if (friendSet.has(target.id)) status = 'Friend';
      else if (sentMap.has(target.id)) status = sentMap.get(target.id) || 'Pending';
      else if (receivedMap.has(target.id)) status = 'Received';

      return { user: target, status };
  });
};

export const sendFriendRequest = async (senderId: string, receiverId: string) => {
  // Check if request already exists
  const { data: existing } = await supabase
    .from('friend_requests')
    .select('id')
    .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
    .maybeSingle();

  if (existing) throw new Error("Request already exists or you are already connected.");

  const { error } = await supabase.from('friend_requests').insert([{ sender_id: senderId, receiver_id: receiverId, status: 'Pending' }]);
  if (error) throw error;
};

export const respondToRequest = async (requestId: string, status: 'Accepted' | 'Rejected') => {
  const { data: req, error } = await supabase
    .from('friend_requests')
    .update({ status: status })
    .eq('id', requestId)
    .select()
    .single();
  
  if (error) throw error;

  if (status === 'Accepted') {
    // Create friend record
    await supabase.from('friends').insert([{ user_id: req.sender_id, friend_id: req.receiver_id }]);
  }
};

export const getIncomingRequests = async (myUnifiedId: string): Promise<FriendRequest[]> => {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('receiver_id', myUnifiedId)
    .eq('status', 'Pending');
  
  if (error) throw error;
  
  const hydrated = await Promise.all(data.map(async (req: any) => {
    const { data: rawSender } = await supabase.from('alumni_users').select('*').eq('id', req.sender_id).single();
    if (rawSender) {
        const [h] = await hydrateAlumniUsers([rawSender]);
        return { ...req, sender: h };
    }
    return req;
  }));

  return hydrated;
};

export const getFriends = async (myUnifiedId: string): Promise<Friend[]> => {
  // Find friends where I am user_id OR friend_id
  const { data, error } = await supabase
    .from('friends')
    .select('*')
    .or(`user_id.eq.${myUnifiedId},friend_id.eq.${myUnifiedId}`);

  if (error) throw error;

  const friends = await Promise.all(data.map(async (f: any) => {
    const friendId = f.user_id === myUnifiedId ? f.friend_id : f.user_id;
    const { data: rawFriend } = await supabase.from('alumni_users').select('*').eq('id', friendId).single();
    if (rawFriend) {
        const [h] = await hydrateAlumniUsers([rawFriend]);
        return { ...f, friend_details: h };
    }
    return f;
  }));

  return friends;
};

// --- MESSAGING ---

export const getConversations = async (myUnifiedId: string): Promise<Conversation[]> => {
  const { data, error } = await supabase
    .from('private_conversations')
    .select('*')
    .or(`user_one.eq.${myUnifiedId},user_two.eq.${myUnifiedId}`);

  if (error) throw error;

  const convos = await Promise.all(data.map(async (c: any) => {
    const otherId = c.user_one === myUnifiedId ? c.user_two : c.user_one;
    const { data: rawUser } = await supabase.from('alumni_users').select('*').eq('id', otherId).single();
    let otherUser;
    if (rawUser) {
        [otherUser] = await hydrateAlumniUsers([rawUser]);
    }

    // Get last message
    const { data: lastMsg } = await supabase.from('private_messages').select('*').eq('conversation_id', c.id).order('sent_at', { ascending: false }).limit(1).maybeSingle();

    return { ...c, other_user: otherUser, last_message: lastMsg };
  }));

  return convos;
};

export const getPrivateMessages = async (conversationId: string) => {
  const { data, error } = await supabase
    .from('private_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true });
  if (error) throw error;
  return data as Message[];
};

export const sendPrivateMessage = async (conversationId: string, senderId: string, text: string) => {
  // Double check user belongs to conversation
  const { data: convo } = await supabase.from('private_conversations').select('*').eq('id', conversationId).single();
  if (!convo || (convo.user_one !== senderId && convo.user_two !== senderId)) {
      throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from('private_messages')
    .insert([{ conversation_id: conversationId, sender_id: senderId, message: text }]);
  if (error) throw error;
};

export const startConversation = async (myUnifiedId: string, friendId: string): Promise<string> => {
  // 1. Strict Privacy Check: MUST BE FRIENDS
  const { data: friendRecord } = await supabase
    .from('friends')
    .select('id')
    .or(`and(user_id.eq.${myUnifiedId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${myUnifiedId})`)
    .maybeSingle();

  if (!friendRecord) {
      throw new Error("PRIVACY RESTRICTION: You can only send private messages to users in your Friends list. Please send a friend request first.");
  }

  // 2. Check existing conversation
  const { data: existing } = await supabase
    .from('private_conversations')
    .select('id')
    .or(`and(user_one.eq.${myUnifiedId},user_two.eq.${friendId}),and(user_one.eq.${friendId},user_two.eq.${myUnifiedId})`)
    .maybeSingle();

  if (existing) return existing.id;

  // 3. Create new conversation
  const { data, error } = await supabase
    .from('private_conversations')
    .insert([{ user_one: myUnifiedId, user_two: friendId }])
    .select()
    .single();
  
  if (error) throw error;
  return data.id;
};

// --- FORUMS ---

export const getForums = async () => {
  const { data, error } = await supabase.from('forums').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data as Forum[];
};

export const createForum = async (creatorId: string, title: string, desc: string, isPrivate: boolean) => {
  const { error } = await supabase.from('forums').insert([{ 
    title, description: desc, created_by: creatorId, is_private: isPrivate 
  }]);
  if (error) throw error;
};

export const getForumPosts = async (forumId: string) => {
  const { data, error } = await supabase
    .from('forum_posts')
    .select('*')
    .eq('forum_id', forumId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;

  // Hydrate authors
  const posts = await Promise.all(data.map(async (p: any) => {
    const { data: rawAuthor } = await supabase.from('alumni_users').select('*').eq('id', p.author_id).single();
    let author;
    if (rawAuthor) [author] = await hydrateAlumniUsers([rawAuthor]);
    return { ...p, author };
  }));

  return posts as ForumPost[];
};

export const createPost = async (forumId: string, authorId: string, content: string) => {
  const { error } = await supabase.from('forum_posts').insert([{ forum_id: forumId, author_id: authorId, content }]);
  if (error) throw error;
};

// --- GROUPS ---

export const getGroups = async (myUnifiedId: string) => {
  // Get groups I am a member of
  const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', myUnifiedId);
  if (!memberships || memberships.length === 0) return [];

  const groupIds = memberships.map(m => m.group_id);
  const { data: groups, error } = await supabase.from('groups').select('*').in('id', groupIds);
  if (error) throw error;
  return groups as Group[];
};

export const createGroup = async (creatorId: string, name: string) => {
  const { data: group, error } = await supabase.from('groups').insert([{ name, created_by: creatorId }]).select().single();
  if (error) throw error;
  
  // Add creator as Admin
  await supabase.from('group_members').insert([{ group_id: group.id, user_id: creatorId, role: 'Admin' }]);
  return group;
};

export const getGroupMessages = async (groupId: string) => {
  const { data, error } = await supabase.from('group_messages').select('*').eq('group_id', groupId).order('sent_at', { ascending: true });
  if (error) throw error;
  
  // Hydrate senders
  const messages = await Promise.all(data.map(async (m: any) => {
    const { data: rawSender } = await supabase.from('alumni_users').select('*').eq('id', m.sender_id).single();
    let sender;
    if (rawSender) [sender] = await hydrateAlumniUsers([rawSender]);
    return { ...m, sender };
  }));
  
  return messages as GroupMessage[];
};

export const sendGroupMessage = async (groupId: string, senderId: string, message: string) => {
  const { error } = await supabase.from('group_messages').insert([{ group_id: groupId, sender_id: senderId, message }]);
  if (error) throw error;
};
