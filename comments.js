import { supabase } from './supabaseClient.js';

let lastCommentTime = 0;
let currentOffset = 0;
const LIMIT = 5;

export async function loadComments(entityId, entityType, reset = true) {
  if (reset) {
    currentOffset = 0;
    document.getElementById('comment-list').innerHTML = '';
  }

  const { data, error } = await supabase
    .from('comments')
    .select('*, comment_likes(count), profiles(username)')
    .eq('entity_id', entityId)
    .eq('entity_type', entityType)
    .order('created_at', { ascending: false })
    .range(currentOffset, currentOffset + LIMIT - 1);

  if (error) {
    console.error(error);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const list = document.getElementById('comment-list');
  if (!list) {
  console.error("Missing #comment-list element");
  return;
}

for (const comment of data) {
let displayName = comment.user_id
  ? comment.user_id.slice(0,6)
  : "anon";

if (comment.profiles?.username) {
  displayName = comment.profiles.username;
} else if (user && user.id === comment.user_id) {
  displayName = user.email;
}

    const isOwner = user && user.id === comment.user_id;

    const div = document.createElement('div');
    div.className = 'comment';

    div.innerHTML = `
      <div class="comment-header">
        <span class="comment-user">${displayName}</span>
        <span class="comment-date">${new Date(comment.created_at).toLocaleString()}</span>
        ${comment.updated_at ? '<span class="comment-edited">(edited)</span>' : ''}
        ${isOwner ? `<button class="comment-edit" data-id="${comment.id}">Edit</button>` : ''}
        ${isOwner ? `<button class="comment-delete" data-id="${comment.id}">Delete</button>` : ''}
      </div>

      <div class="comment-content" id="content-${comment.id}">
        ${comment.content}
      </div>

      <div class="comment-actions">
        <span class="comment-like" data-id="${comment.id}">❤️</span>
        <span class="like-count">${comment.comment_likes?.[0]?.count || 0}</span>
      </div>
    `;

    list.appendChild(div);
  }

  // DELETE
  document.querySelectorAll('.comment-delete').forEach(btn => {
    btn.onclick = async () => {
      await supabase.from('comments').delete().eq('id', btn.dataset.id);
      loadComments(entityId, entityType, true);
    };
  });

  // EDIT
  document.querySelectorAll('.comment-edit').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const contentEl = document.getElementById(`content-${id}`);
      const oldText = contentEl.innerText;

      const newText = prompt("Edit your comment:", oldText);
      if (!newText || newText.length > 140) return;

const { error } = await supabase.from('comments')
  .update({ 
    content: newText, 
    updated_at: new Date().toISOString() 
  })
  .eq('id', id);

if (error) {
  console.error("UPDATE ERROR:", error);
}

      loadComments(entityId, entityType, true);
    };
  });

  // LIKE
  document.querySelectorAll('.comment-like').forEach(btn => {
    btn.onclick = async () => {
      if (!user) return alert("Login to like");

      const id = btn.dataset.id;

      const { data: existing } = await supabase
        .from('comment_likes')
        .select('*')
        .eq('comment_id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('id', existing.id);
      } else {
        await supabase
          .from('comment_likes')
          .insert([{ comment_id: id, user_id: user.id }]);
      }

      loadComments(entityId, entityType, true);
    };
  });

  currentOffset += LIMIT;

  const loadMoreBtn = document.getElementById('load-more-comments');
  loadMoreBtn.style.display = data.length === LIMIT ? 'block' : 'none';
}

export async function submitComment(entityId, entityType) {
  const input = document.getElementById('comment-input');
  const content = input.value.trim();

  if (!content || content.length > 140) return;

  const now = Date.now();
  if (now - lastCommentTime < 30000) {
    alert('Wait 30 seconds');
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return alert("Login required");

  await supabase.from('comments').insert([{
    user_id: user.id,
    entity_id: entityId,
    entity_type: entityType,
    content
  }]);

  lastCommentTime = now;
  input.value = '';

  loadComments(entityId, entityType, true);
}