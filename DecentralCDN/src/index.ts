import { v4 as uuidv4 } from 'uuid';
import { Server, StableBTreeMap, ic, nat64 } from 'azle';
import express from 'express';

/**
 * This type represents content that can be uploaded to the CDN.
 */
class Content {
    id: string;                // Unique content ID
    title: string;             // Title of the content
    body: string;              // Content itself (e.g., text, URL)
    owner: string;             // Owner's address
    createdAt: nat64;          // Timestamp when the content was created
    updatedAt: nat64 | null;   // Timestamp when the content was last updated
    version: number;           // Version number for the content
}

/**
 * Metadata to track content access.
 */
class AccessControl {
    contentId: string;        // Content ID
    allowedUsers: Set<string>; // Set of users allowed to access the content
}

// Storage for content
const contentStorage = new StableBTreeMap<string, Content>(0, 44, 1024);
// Storage for access control
const accessControlStorage = new StableBTreeMap<string, AccessControl>(1, 44, 1024);

// Create a new content item
export function uploadContent(owner: string, title: string, body: string): string {
    const contentId = uuidv4();
    const createdAt = getCurrentTime();
    
    const newContent: Content = {
        id: contentId,
        title,
        body,
        owner,
        createdAt,
        updatedAt: null,
        version: 1
    };

    contentStorage.insert(contentId, newContent);
    
    // Create access control for the new content (initially allow only the owner)
    const accessControl: AccessControl = {
        contentId,
        allowedUsers: new Set([owner])
    };
    accessControlStorage.insert(contentId, accessControl);
    
    return `Content uploaded successfully with ID=${contentId}`;
}

// Get content by ID
export function getContent(contentId: string, userId: string): Content | string {
    const accessControlOpt = accessControlStorage.get(contentId);
    
    if (accessControlOpt === undefined) {
        return `Content with ID=${contentId} not found`;
    }

    const accessControl = accessControlOpt;

    // Check if user has access
    if (!accessControl.allowedUsers.has(userId) && accessControl.allowedUsers.size > 0) {
        return `Access denied to content with ID=${contentId}`;
    }

    const contentOpt = contentStorage.get(contentId);
    if (contentOpt === undefined) {
        return `Content with ID=${contentId} not found`;
    }

    return contentOpt;
}

// Update content by ID
export function updateContent(contentId: string, updater: string, newTitle?: string, newBody?: string): string {
    const contentOpt = contentStorage.get(contentId);
    if (contentOpt === undefined) {
        return `Content with ID=${contentId} not found`;
    }

    const content = contentOpt;

    // Check if the updater is the owner
    if (content.owner !== updater) {
        return `Only the owner can update this content`;
    }

    const updatedContent: Content = {
        ...content,
        title: newTitle || content.title,
        body: newBody || content.body,
        updatedAt: getCurrentTime(),
        version: content.version + 1 // Increment version
    };

    contentStorage.insert(contentId, updatedContent);
    return `Content with ID=${contentId} updated successfully`;
}

// Set access for content
export function setAccess(contentId: string, owner: string, allowedUser: string, allow: boolean): string {
    const accessControlOpt = accessControlStorage.get(contentId);
    if (accessControlOpt === undefined) {
        return `Content with ID=${contentId} not found`;
    }

    const accessControl = accessControlOpt;

    // Check if the owner is modifying access
    if (accessControl.contentId !== contentId) {
        return `Only the owner can modify access for this content`;
    }

    if (allow) {
        accessControl.allowedUsers.add(allowedUser);
    } else {
        accessControl.allowedUsers.delete(allowedUser);
    }

    accessControlStorage.insert(contentId, accessControl);
    return `Access updated for content with ID=${contentId}`;
}

// Get all content metadata (public query)
export function getAllContent(): Content[] {
    return contentStorage.values();
}

// Helper function to get current time
function getCurrentTime(): nat64 {
    return ic.time() as nat64;
}
